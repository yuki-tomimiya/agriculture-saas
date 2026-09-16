import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_FILE = 'Tillto_開発議事録.docx'
const CONTENT_FILE = 'minutes-content.json'

function heading(text, level) {
  const map = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
  }
  return new Paragraph({ text, heading: map[level] ?? HeadingLevel.HEADING_2 })
}

function para(text) {
  return new Paragraph({ children: [new TextRun({ text })] })
}

function blank() {
  return new Paragraph({ children: [new TextRun('')] })
}

function buildChildren(data) {
  const children = [
    heading(data.title, 1),
    para(`最終更新：${data.lastUpdated}`),
    blank(),
    heading('更新履歴', 1),
  ]

  for (const entry of [...data.changelog].reverse()) {
    children.push(para(`${entry.date} … ${entry.summary}`))
  }
  children.push(blank())

  for (const section of data.sections) {
    children.push(heading(section.heading, section.level ?? 1))
    for (const text of section.paragraphs ?? []) {
      children.push(para(text))
    }
    for (const sub of section.subsections ?? []) {
      children.push(heading(sub.heading, 2))
      for (const text of sub.paragraphs ?? []) {
        children.push(para(text))
      }
    }
    children.push(blank())
  }

  return children
}

const contentPath = path.join(__dirname, CONTENT_FILE)
const data = JSON.parse(fs.readFileSync(contentPath, 'utf8'))
const doc = new Document({
  sections: [{ properties: {}, children: buildChildren(data) }],
})
const buffer = await Packer.toBuffer(doc)
const outPath = path.join(__dirname, OUT_FILE)
fs.writeFileSync(outPath, buffer)
console.log(`Updated: ${outPath}`)
