/**
 * The base url for the HAL API. API requests should be built upon it.
 * @type {string}
 */
const HAL_API_URL = 'http://api.archives-ouvertes.fr/search/'

/**
 * The fields we want to get when requesting publications.
 *
 * - docid : The document unique id (internal to HAL, guaranteed to be unique
 *   but not really useful to us).
 * - label_s : The publication natural language citation (authors, title, date,
 *   location, HAL identifier).
 * - uri_s : Link to the HAL publication.
 * - title_s : Array of titles (one per language).
 * - doiId_s : The unique DOI (Digital Object Identifier) ; not always present.
 * - halId_s : The unique HAL identifier for this publication, often used to
 *   refer to HAL publications.
 * - abstract_s : The publication's abstract ("summary").
 * - publicationDate_s : The date when it was published.
 * - publicationLocation_s : Where it was published (conference name, journal
 *   name, etc.) ; not always present.
 * - authFullName_t : The array of authors' names ; not always present.
 * @type {string[]}
 */
const fields = [
  'docid', 'label_s', 'uri_s', 'title_s', 'doiId_s', 'halId_s',
  'abstract_s', 'keyword_s', 'publicationDate_s', 'publicationLocation_s',
  'authFullName_s', 'bookTitle_s', 'conferenceTitle_s', 'docType_s',
  'journalTitle_s', 'label_bibtex',
]


/**
 * Request the HAL API and get all publications for a given author.
 * @param authorId The HAL "author-id" for the desired author. Note that this
 *   author-id is chosen by the author themselves, e.g., `remy-chaput`.
 * @return {Promise<*>} A promise that resolves to the list of publications;
 *   each publication contains the fields declared in {@link fields}.
 */
export async function getPublicationsFromAuthorId(authorId) {
  const search_url = `${HAL_API_URL}?q=authIdHal_s:${authorId}&wt=json&fl=${fields.join(',')}`
  // TODO: handle pagination?
  //   using nrows or cursor?
  const response = await fetch(search_url)
  if (response.ok) {
    const data = await response.json()
    return data.response.docs
  } else {
    const error = await response.text()
    throw new Error(error)
  }
}
