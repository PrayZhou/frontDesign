// These optional fields are shared by a standalone design brief and a v1 component plan.
export function isReadingPurpose(purpose) {
  return purpose === 'understand' || purpose === 'explore';
}

const hasText = value => typeof value === 'string' && value.trim().length > 0;

export function visualIntentErrors(intent) {
  const errors = [];
  function invalid(field, message) {
    errors.push({ code: 'invalid-visual-intent', path: '/designIntent/' + field, message });
  }
  if (intent.purpose !== undefined && intent.purpose !== 'act' && !isReadingPurpose(intent.purpose)) {
    invalid('purpose', 'Use act, understand, or explore for the main purpose.');
  }
  if (Array.isArray(intent.styleDirections)) {
    intent.styleDirections.forEach((direction, index) => {
      if (direction?.sketch !== undefined && !hasText(direction.sketch)) {
        invalid(`styleDirections/${index}/sketch`, 'Supply a path or reference to the sketch.');
      }
    });
  }
  const composition = intent.composition;
  if (composition === undefined) return errors;
  if (!composition || typeof composition !== 'object' || Array.isArray(composition)) {
    invalid('composition', 'Describe the first read, reading order, and tradeoff in an object.');
    return errors;
  }
  for (const field of ['firstRead', 'tradeoff']) {
    if (!hasText(composition[field])) invalid('composition/' + field, 'Expected a non-empty description.');
  }
  if (!Array.isArray(composition.readingOrder) || !composition.readingOrder.length || !composition.readingOrder.every(hasText)) {
    invalid('composition/readingOrder', 'List the content in its intended reading order.');
  }
  return errors;
}
