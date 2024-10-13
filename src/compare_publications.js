import levenshtein from 'js-levenshtein'


/**
 * Find the local publication that best match a target publication from HAL.
 *
 * Publications are compared in terms of their HAL IDs, DOIs, titles, authors,
 * and published dates.
 *
 * @param targetHalPublication The HAL publication for which we want to find
 *   a corresponding "local" (existing) one.
 * @param existingPublications The list of local (existing) publications, from
 *   which we will search the best match.
 * @return {{confidence: number, best: *}|{confidence: number, best: null}} The
 *   best match and its confidence score, between 0 and 1. If the score is 1,
 *   it is usually a perfect match (typically, exact same DOI).
 */
export function findCorrespondingPublication(targetHalPublication, existingPublications) {
  let best_candidate = null
  let best_confidence = 0.0
  for (const candidate of existingPublications) {
    if (haveSameHalID(targetHalPublication, candidate)) {
      // If the HAL ID is present and equal, we know for sure this is the best candidate.
      return { best: candidate, confidence: 1.0 }
    } else if (haveSameDOI(targetHalPublication, candidate)) {
      // Same for DOI, we know this is the best candidate.
      return { best: candidate, confidence: 1.0 }
    }
    // Otherwise, let us compute some confidence over whether this is a good candidate
    const titleSimilarity = computeTitleSimilarity(targetHalPublication, candidate)
    const authorsSimilarity = computeAuthorsSimilarity(targetHalPublication, candidate)
    const dateSimilarity = computeDateSimilarity(targetHalPublication, candidate)
    // TODO: add more measures of similarities: based on keywords, authors, abstract, ...
    // // - Publication location (conference, journal, ...)
    //
    // // - Tags / keywords
    // const halKeywords = targetHalPublication['keyword_t']
    // const candidateKeywords = candidate['tags']

    const validMeasures = [titleSimilarity, authorsSimilarity, dateSimilarity, authorsSimilarity].filter(
      measure => measure != null && !isNaN(measure)
    )
    const confidence = validMeasures.reduce((a,b) => a + b, 0) / validMeasures.length
    if (confidence > best_confidence) {
      best_confidence = confidence
      best_candidate = candidate
    }
  }

  return { best: best_candidate, confidence: best_confidence }
}


/**
 * Compare the HAL ID of two publications.
 * @param target The HAL publication.
 * @param candidate The "local" candidate publication.
 * @return {boolean} True if their HAL IDs are equal, plus-or-minus an optional
 *   "v..." part at the end (e.g., `hal-012345v1` and `hal-012345` are equal).
 */
function haveSameHalID(target, candidate) {
  let targetHal = target['halId_s']
  // The HAL ID might contain an optional version at the end. We don't care for it.
  if (targetHal) {
    targetHal = targetHal.replace(/v\d+$/, '');
  }
  let candidateHal = candidate['hal']
  if (candidateHal) {
    candidateHal = candidateHal.replace(/v\d+$/, '');
  }
  return targetHal && targetHal === candidateHal
}


/**
 * Compare the DOI of two publications.
 * @param target The HAL publication.
 * @param candidate The "local" candidate.
 * @return {boolean} True if their DOIs are present and equal.
 */
function haveSameDOI(target, candidate) {
  const targetDOI = target['doiId_s']
  const candidateDOI = candidate['doi']
  return targetDOI != null && targetDOI === candidateDOI
}


/**
 * Measure the similarity between two publications' titles.
 * @param target The target HAL publication. Note that HAL may return several
 *   titles (one for each language): in this case, we compute the similarity
 *   for each of these titles and return the maximum.
 * @param candidate The "local" candidate.
 * @return {*|number} A similarity between 0 (completely different) and 1
 *   (exactly the same). It is measured with a Levenshtein distance
 *   ({@link https://en.wikipedia.org/wiki/Levenshtein_distance}), then
 *   normalized to 0-1 based on the greatest title length.
 * @see stringSimilarity
 */
function computeTitleSimilarity(target, candidate) {
  const halTitle = target['title_s']
  const candidateTitle = candidate['title']
  if (!(halTitle && candidateTitle)) {
    return NaN
  } else if (Array.isArray(halTitle)) {
    // The HAL title might be an array (one title for each language)
    // We should in this case compare all languages and return the highest similarity.
    return halTitle
        .map((langHalTitle) => stringSimilarity(langHalTitle, candidateTitle))
        .reduce((a, b) => Math.max(a, b), 0)
  }
  return stringSimilarity(halTitle, candidateTitle)
}


/**
 * Compute the similarity between two publications' authors.
 * @param target The target HAL publication.
 * @param candidate The "local" candidate.
 * @return {*|number} A similarity between 0 (completely different) and 1
 *   (exactly equal). Authors are typically lists of strings; we could compare
 *   them one-by-one, but we might have problems because of accents, lower/upper
 *   case, and other typos; instead, we transform to a single string and use
 *   a Levenshtein distance.
 */
function computeAuthorsSimilarity(target, candidate) {
  // We could also check authors one by one, because we have arrays; but we may have mistakes in authors' names ...
  const targetAuthors = target['authors_t'] && target['authors_t'].join(', ')
  const candidateAuthors = candidate['authors'] && candidate['authors'].join(', ')
  if (!(targetAuthors && candidateAuthors)) {
    return NaN
  }
  return stringSimilarity(targetAuthors, candidateAuthors)
}


/**
 * Compute the similarity between two publications' published dates.
 * @param target The target HAL publication.
 * @param candidate The "local" candidate.
 * @return {number} A similarity between 1 (exactly equal) and 0
 *   (about a year of difference). The similarity is first measured
 *   as a number of days of difference; then the days are mapped to
 *   0-1 using a custom function that yields high value for `0 < x < 30`,
 *   so that we allow a few errors in the same month. The similarity then
 *   quickly decrease and is near 0 when the difference is about a year.
 *   Note that this measure is not resilient to typos, e.g., 2021-01-01 and
 *   2022-01-01 have a near-0 similarity, even though it could have just been
 *   a mistake.
 */
function computeDateSimilarity(target, candidate) {
  // - Publication date
  let targetDate = target['publicationDate_s']
  if (targetDate && !(targetDate instanceof Date)) {
    targetDate = new Date(targetDate)
  }
  let candidateDate = candidate['date']
  if (candidateDate && !(candidateDate instanceof Date)) {
    candidateDate = new Date(candidateDate)
  }
  if (!(targetDate && candidateDate)) {
    return NaN
  }
  const differenceInMs = Math.abs(candidateDate - targetDate)
  const differenceInDays = differenceInMs / (1000 * 60 * 60 * 24)
  // We want a similarity of 1 when x==0 (no difference)
  // A similarity close to 1 when 0 < x < 30 (same month, potential mistake)
  // Then decreasing quickly as x grows... (near 0 when x > 365)
  // The following formula yields more or less this behaviour: exp(-x/k)
  return Math.exp(- differenceInDays / 150)
}


/**
 * Compute a similarity measure on two strings, by using the Levenshtein distance.
 *
 * The Levenshtein distance returns the number of modifications that should be
 * made to transform a string into the other. We take the opposite, and divide
 * by the greatest length to get a similarity (instead of a distance) in 0-1.
 *
 * We use an external library to get a fully optimized Levenshtein, instead of
 * a naive version that takes too much time for long strings (such as titles
 * or abstracts).
 *
 * @param str1 The first string to compare.
 * @param str2 The second string to compare.
 * @return {number} The similarity, between 0 (completely different) and 1
 *   (exactly equal).
 */
function stringSimilarity(str1, str2) {
  const distance = levenshtein(str1, str2)
  const maxLength = Math.max(str1.length, str2.length)
  return 1.0 - (distance / maxLength)
}
