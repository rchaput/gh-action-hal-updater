import fs from 'fs'
import path from 'path'
import toml from '@iarna/toml'
import yaml from 'js-yaml'


/**
 * Read and parse "local" (existing) publications from a local folder.
 * @param publicationsFolder The **absolute** path to the local folder.
 *   Typically, with Hugo, it should look like `/path/to/project/content/publication`.
 * @return {*} An array of parsed publications.
 */
export function getLocalPublications(publicationsFolder) {
  // TODO: we should emit a warning when we fail to parse a publication then
  //   ignore and continue parsing the others (to avoid crashing the workflow).
  return listExistingPublications(publicationsFolder).map(dir => readExistingPublicationDetails(dir))
}

/**
 * List all existing publications in the local folder `content/publication`.
 * Publications are supposed to be represented by `{folder_name}/index.md` files,
 * with one folder per publication.
 * @param publicationsFolder The **absolute** path to the local folder.
 * @return {*} The list of folders containing a publication.
 */
function listExistingPublications(publicationsFolder) {
  const contents = fs.readdirSync(publicationsFolder, { withFileTypes: true })
  const directories = contents.filter( (entry) => entry.isDirectory())
  return directories.map( (dir) => path.join(dir.parentPath, dir.name))
}


/**
 * Read and parse a single publication from the local folder.
 * @param folderPath The absolute path to the folder containing the publication.
 *   Typically, it should look like `/path/to/project/content/publications/stubname`
 * @return {*} The parsed publication, and especially its metadata (title,
 *   authors, date, hal, doi, ...).
 */
function readExistingPublicationDetails(folderPath) {
  let documentStr = fs.readFileSync(`${folderPath}/index.md`, 'utf8')
  // Remove unnecessary whitespaces before the first delimiters
  documentStr = documentStr.trim()
  // Convert to array to simplify line manipulation
  documentStr = documentStr.split('\n')
  // The delimiter tells us if this is TOML (`+++`) or YAML (`---`)
  const delimiter = documentStr[0]
  // We only want the metadata content (frontmatter), i.e., between the delimiters!
  const nextDelimiterIndex = documentStr.indexOf(delimiter, 2)
  documentStr = documentStr.slice(1, nextDelimiterIndex).join('\n')
  let document
  if (delimiter === '+++') {
    document = toml.parse(documentStr)
  } else if (delimiter === '---') {
    document = yaml.load(documentStr)
  } else {
    throw Error(`Unrecognized delimiter: ${delimiter}`)
  }
  // TODO: maybe we should create some other structure instead of modifying the parsed document...
  document['folderPath'] = folderPath
  document['folderName'] = path.basename(folderPath)
  return document
}
