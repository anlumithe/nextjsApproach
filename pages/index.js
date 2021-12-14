import Head from 'next/head'
import Image from 'next/image'
//import styles from '../styles/Home.module.css'
import { Fragment } from "react";
import { Client } from '@notionhq/client'
import styles from './text.module.css'
import { buildRequestError } from '@notionhq/client/build/src/errors';
import { render } from 'react-dom';

export const Text = ({ text }) => {
  if (!text) {
    return null;
  }
  return text.map((value) => {
    const {
      annotations: { bold, code, color, italic, strikethrough, underline },
      text,
    } = value;
    return (
      <span
        className={[
          bold ? styles.bold : "",
          code ? styles.code : "",
          italic ? styles.italic : "",
          strikethrough ? styles.strikethrough : "",
          underline ? styles.underline : "",
        ].join(" ")}
        style={color !== "default" ? { color } : {}}
      >
        {text.link ? <a href={text.link.url} style={{textDecoration:'underline', color:'grey'}}>{text.content}</a> : text.content}
      </span>
    );
  });
};

const renderBlock = (block) => {
  const { type, id } = block;
  const value = block[type];

  switch (type) {
    case "paragraph":
      return (
        <p>
          <Text text={value.text} />
        </p>
      );
    case "heading_1":
      return (
        <h1>
          <Text text={value.text} />
        </h1>
      );
    case "heading_2":
      return (
        <h2>
          <Text text={value.text} />
        </h2>
      );
    case "heading_3":
      return (
        <h3>
          <Text text={value.text} />
        </h3>
      );
    case "bulleted_list_item":
    case "numbered_list_item":
      return (
        <li>
          <Text text={value.text} />
        </li>
      );
    case "to_do":
      return (
        <div>
          <label htmlFor={id}>
            <input type="checkbox" id={id} defaultChecked={value.checked} />{" "}
            <Text text={value.text} />
          </label>
        </div>
      );
    case "toggle":
      return (
        <details>
          <summary>
            <Text text={value.text} />
          </summary>
          {value.children?.map((block) => (
            <Fragment key={block.id}>{renderBlock(block)}</Fragment>
          ))}
        </details>
      );
    case "child_page":
      return <p>{value.title}</p>;
    case "image":
      const src =
        value.type === "external" ? value.external.url : value.file.url;
      const caption = value.caption ? value.caption[0].plain_text : "";
      return (
        <figure>
          <img src={src} alt={caption} width='600 pt'/>
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      );
    case "callout":
      return(
        <p style={{backgroundColor:'lightgrey', padding:'3%', borderRadius:'5px'}}>{value.icon.emoji}
            <Text text={value.text} />
        </p>
      );
    case "column_list":
      return(renderColumnBlock(value));

    default:
      return `❌ Unsupported block (${
        type === "unsupported" ? "unsupported by Notion API" : type
      })`;
  }
};
const renderColumnBlock = (block) =>{
  let columnBlockValues = [];
  let listOfRenderedBlocks = [];
  for(let i = 0; i<block.children.results.length; i++){
    let columnObject = block.children.results[i];
    for(let y = 0; y<columnObject.column.children.results.length; y++){
      let content = columnObject.column.children.results[y];
      columnBlockValues.push(content)
      //console.log(content)
      if(content.has_children){
        content[content.type].children.results.forEach(childInColumn => columnBlockValues.push(childInColumn))
      }
    }
  }
  //block.children.results.forEach(columnObject => columnObject.column.children.results.forEach(content => columnBlockValues.push(content)))
  columnBlockValues.forEach( line => listOfRenderedBlocks.push(renderBlock(line)))
  return listOfRenderedBlocks;
};

const Home = ({ page, blocks, childBlocks, title, icon, text}) => {
  return (
  <div style={{marginLeft:'20%', marginRight: '20%', marginBottom: '10%', marginTop: '5%'}}>
    <article>
        {/* <pre>{JSON.stringify(page, null, 2)}</pre> */}
        <h1 style={{fontSize:'45pt'}}>{page.icon.emoji}</h1>
        <h1 style={{fontSize:'30pt'}}>{page.properties.title.title[0].plain_text}</h1>
        <section>
          {blocks.map((block) => (
            <Fragment key={block.id}>{renderBlock(block)}</Fragment>
          ))}
        </section>
      </article>
    </div>
  )
};

export const getStaticProps = async () => {
  const notion = new Client({
    auth: process.env.NOTION_SECRET,
  });
  const pageInfo = await notion.pages.retrieve({ page_id: process.env.PAGE_ID });
  const data = await notion.blocks.children.list({
    block_id: process.env.PAGE_ID,
    page_size: 1000,
  });

  const childBlocks = await Promise.all(
    data.results
      .filter((block) => block.has_children)
      .map(async (block) => {
        return {
          id: block.id,
          children: await notion.blocks.children.list({
            block_id: block.id,
            page_size: 50,
          }),
        };
      })
  );

  let listOfChildBlocks = [];
  childBlocks.forEach(x => x.children.results.forEach(y => listOfChildBlocks.push(y)))

  const grandchildBlocks = await Promise.all(
    listOfChildBlocks
      .filter((block) => block.has_children)
      .map(async (block) => {
        return {
          id: block.id,
          children: await notion.blocks.children.list({
            block_id: block.id,
            page_size: 50,
          }),
        };
      })
  );

  let listOfGrandchildBlocks = [];
  grandchildBlocks.forEach(x => x.children.results.forEach(y => listOfGrandchildBlocks.push(y)))

  const superchildBlocks = await Promise.all(
    listOfGrandchildBlocks
      .filter((block) => block.has_children)
      .map(async (block) => {
        return {
          id: block.id,
          children: await notion.blocks.children.list({
            block_id: block.id,
            page_size: 50,
          }),
        };
      })
  );

  //console.log(superchildBlocks)

  const blocksWithChildren = data.results.map((block) => {
    // Add child blocks if the block should contain children but none exists
    if (block.has_children && !block[block.type].children) {
      block[block.type]["children"] = childBlocks.find(
        (x) => x.id === block.id
      )?.children;
      //console.log(block[block.type]["children"].results[0].type);
      for (let i = 0; i < block[block.type].children.results.length; i++) { 
        if (block[block.type].children.results[i].has_children) {
          var jsonObj = block[block.type].children.results[i];
          jsonObj.column.children = grandchildBlocks.find(
            (x) => x.id === block[block.type].children.results[i].id
          )?.children;
          //console.log(jsonObj.column.children);
          for (let j = 0; j < jsonObj.column.children.results.length; j++) { 
            if (jsonObj.column.children.results[j].has_children) {
              var newJsonObj = jsonObj.column.children.results[j];
              newJsonObj.paragraph.children = superchildBlocks.find(
                (x) => x.id === jsonObj.column.children.results[j].id
              )?.children;
            }
          }
        }
      }
    }
    return block;
  });
  const blocksWithGrandchildren = blocksWithChildren.map((block) => {
    // Add child blocks if the block should contain children but none exists
    

    return block;

  });


  return{
    props: {
      page: pageInfo,
      blocks: blocksWithChildren,
      children: childBlocks,
    }
  };
};
export default Home;