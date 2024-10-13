import * as core from '@actions/core'
import { getPublicationsFromAuthorId } from './hal_api.js'
import { getLocalPublications } from './local_publications.js'
import { findCorrespondingPublication } from './compare_publications.js'
import { createPullRequests } from './create_pr.js'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
  try {
    // Get publications from HAL
    const authorId = core.getInput('author-id')
    core.info(`Requesting publications FROM HAL author-id: ${authorId}`)
    const halPublications = await getPublicationsFromAuthorId(authorId)
    core.debug(`Found ${halPublications.length} HAL publications`)

    // Get publications from local folder
    const localPath = core.getInput('local-path')
    core.info(`Parsing publications from local folder: ${localPath}`)
    const localPublications = getLocalPublications(localPath)
    core.debug(`Found ${localPublications.length} local publications`)

    // Find corresponding publications
    const confidenceThreshold = Number.parseFloat(core.getInput('confidence-threshold'))
    core.info('Comparing publications')
    const results= []
    for (const halPublication of halPublications) {
      const { best, confidence } = findCorrespondingPublication(halPublication, localPublications)
      const accepted = confidence >= confidenceThreshold
      core.debug(`HAL publication ${halPublication['halId_s']} => ${best['folderName']} (match=${accepted} ; confidence=${confidence})`)
      results.push({
        target: halPublication,
        candidate: best,
        confidence,
        accepted,
      })
    }

    // Log results to the GitHub Step Summary file
    await logToSummary(results)

    // Create Pull Requests for each missing publication
    const missingPublications = results
      .filter(result => !result.accepted)
      .map(result => result.target)
    const { allCreatedFiles, body } = createPullRequests(missingPublications)

    core.setOutput('created-files', allCreatedFiles)
    core.setOutput('body', body)

  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}


/**
 * Log the results to the GitHub Step Summary file.
 *
 * @param results List of results (one for each HAL publication). Each result
 *   must contain `{ target, candidate, confidence, accepted }`, where
 *   `target` is the HAL publication, `candidate` is the local publication
 *   with the maximum confidence, `confidence` is the similarity between
 *   `target` and `candidate`, and `accepted` is whether the `candidate` is
 *   a suitable match for `target`, i.e., whether its confidence is above
 *   a given threshold.
 */
async function logToSummary(results) {
  await core.summary.clear()

  // Print short summary (counts)
  const notFound = results.filter(result => !result.accepted).length
  const found = results.filter(result => result.accepted).length
  core.summary.addRaw(`:white_check_mark: Found: ${found} / :x: Not found: ${notFound} / TOTAL: ${notFound + found}`).addBreak()

  // Sort results by failed first (they are more important)
  // In the lambda, negative values indicate that res1 is before res2
  const sortedResults = results.toSorted(
    (res1, res2) => res1.accepted - res2.accepted,
  )
  // Print a detailed section for each (sorted) result
  for (const { target, candidate, confidence, accepted } of sortedResults) {
    logSinglePublicationToSummary(target, candidate, confidence, accepted)
  }

  await core.summary.write()
}


/**
 * Log a single publication to the GitHub Step Summary file.
 *
 * @param halPublication The HAL publication (target).
 * @param bestPublication The best local publication (candidate).
 * @param confidence The similarity between the target and the candidate.
 * @param accepted Whether the candidate is a suitable match (based on the
 *   confidence and a threshold).
 */
function logSinglePublicationToSummary(halPublication, bestPublication, confidence: Number, accepted: boolean) {
  // Print header
  if (accepted) {
    core.summary.addHeading(`:white_check_mark: ${halPublication['docid']}`, 2).addEOL()
  } else {
    core.summary.addHeading(`:x: ${halPublication['docid']}`, 2).addEOL()
    core.notice(`HAL publication ${halPublication['halId_s']} has no corresponding publication`)
  }
  // Print confidence
  core.summary.addRaw(`Confidence of best matching: ${confidence.toFixed(2)}`).addBreak()
  // Print link to HAL publication
  core.summary.addLink(halPublication['uri_s'], halPublication['uri_s']).addBreak()
  // Print table comparing the HAL publication (target) with the best matching
  // Arrays of rows; each rows is an array of cells
  const tableData = [
    [
      {data: 'Field', header: true},
      {data: 'HAL (target)', header: true},
      {data: 'Local (candidate)', header: true},
    ],
    [
      {data: 'HAL ID'},
      {data: halPublication['halId_s']},
      {data: bestPublication['hal']},
    ],
    [
      {data: 'DOI'},
      {data: halPublication['doi_s']},
      {data: bestPublication['doi']},
    ],
    [
      {data: 'Title'},
      {data: halPublication['title_s']},
      {data: bestPublication['title']},
    ],
    [
      {data: 'Authors'},
      {data: halPublication['authors_t']},
      {data: bestPublication['authors']},
    ],
    [
      {data: 'Date'},
      {data: halPublication['publicationDate_s']},
      {data: bestPublication['date']},
    ]
  ]
  core.summary.addTable(tableData).addBreak()
}
