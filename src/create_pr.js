import * as core from '@actions/core'
import fs from 'fs'


export function createPullRequests(publications) {
  const allCreatedFiles = []
  let body = `Automatic Pull Request from GH-Hal-Updater.

The following HAL publications were considered missing and are added in this PR: 

`
  for (const publication of publications) {
    allCreatedFiles.push(...createFiles(publication))
    body = body + `- [${publication['halId_s']}](${publication['uri_s']})\n\n`
  }

  // TODO: for now, it seems complicated to create the PR ourselves, even
  //   when using @actions/github (need to create a commit manually, then push
  //   to a new branch, and finally create the PR based on this branch...)
  //   We will use instead another action, which needs the paths of created
  //   files, and the PR body content.
  return { allCreatedFiles, body }
}


function createFiles(publication) {
  const createdFiles = []
  const localPath = core.getInput('local-path')
  const folderName = publication['halId_s']
  core.debug(`Creating files for ${folderName}`)

  const pathToFolder = `${localPath}/${folderName}`

  fs.mkdirSync(pathToFolder, { recursive: true })

  const pathToIndexMd = `${pathToFolder}/index.md`
  fs.writeFileSync(pathToIndexMd, createIndexMdFile(publication))
  createdFiles.push(pathToIndexMd)
  if (publication['label_bibtex']) {
    const pathToCiteBib = `${pathToFolder}/cite.bib`
    fs.writeFileSync(pathToCiteBib, publication['label_bibtex'])
    createdFiles.push(pathToCiteBib)
  }
  // TODO: also download the PDF file, if available?
  return createdFiles
}


function createIndexMdFile(publication) {
  let title = publication['title_s']
  if (Array.isArray(title)) {
    title = title[0]
  }
  const date = publication['publicationDate_s']
  const authors = formatArray(publication['authFullName_s'])
  const publicationType = parsePublicationType(publication['docType_s'])
  const publicationName = publication['conferenceTitle_s'] || publication['journalTitle_s'] || publication['bookTitle_s']
  const publicationShortName = '' // TODO
  // TODO: we should split into lines of 80 characters each
  const abstract = publication['abstract_s'].join('\n')
  const tags = formatArray(publication['keyword_s'])
  const halId = publication['halId_s']
  const doi = publication['doiId_s']

  return `+++
title = "${title}"
date = ${date}
authors = ${authors}
profile = false

publication_types = ["${publicationType}"]
publication = "${publicationName}"
publication_short = "${publicationShortName}"

abstract = """
${abstract}
"""

# summary = """
# 
# """

tags = ${tags}
featured = false

hal = "${halId}"
${doi ? `doi = "${doi}"` : ''}

# [[links]]
# url = "https://arxiv.org/abs/..."
# name = "ArXiv"
# icon_pack = "ai"
# icon = "arxiv"

+++
`
}


function formatArray(array) {
  if (array) {
    array = '[' + array.map(s => `"${s}"`).join(', ') + ']'
  } else {
    array = '[ ]'
  }
  return array
}


function parsePublicationType(type) {
  // Workshop, conference, journal, technical report, software, ...
  // Problem: workshop is not distinguished from conference in HAL!
  if (type === 'COMM') {
    return 'conference'
  } else if (type === 'ART') {
    return 'journal'
  } else if (type === 'REPORT') {
    return 'report'
  } else if (type === 'SOFTWARE') {
    return 'software'
  } else {
    return ''
  }
}
