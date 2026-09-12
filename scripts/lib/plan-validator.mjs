const requiredDesignIntentFields = ['product', 'audience', 'coreTask', 'visualDirection', 'density'];
const validDensities = new Set(['compact', 'comfortable', 'spacious']);
const canonicalCapabilities = new Set([
  'navigation', 'forms', 'controls', 'data', 'table', 'chart', 'metrics',
  'overlay', 'feedback', 'layout', 'marketing', 'interactive', 'async',
]);
const asyncStates = ['loading', 'empty', 'error', 'success'];
const interactiveImplyingCapabilities = new Set(['forms', 'controls', 'overlay']);
const dataImplyingCapabilities = new Set(['table', 'chart', 'metrics']);
const knownFoundations = new Set(['shadcn', 'heroui', 'mantine', 'mui', 'ant-design', 'chakra-ui']);
const knownEnhancers = new Set(['magicui', 'aceternity']);
const capabilityLibraries = new Set([
  'recharts',
  'tanstack-table',
  '@tanstack/react-table',
  '@tanstack/table-core',
  'lucide',
  'lucide-react',
  'motion',
  'framer-motion',
  'sonner',
]);
const identifierAliases = new Map([
  ['antd', 'ant-design'],
  ['material-ui', 'mui'],
  ['nextui', 'heroui'],
  ['magic-ui', 'magicui'],
  ['chakra', 'chakra-ui'],
]);
const emotionalCarrierLayers = new Set(['visual', 'content', 'interaction', 'structure', 'brand']);
const emotionalRoles = new Set(['focal', 'supporting', 'neutral', 'transition']);
const genericEmotionalTerms = new Set([
  '高级', '高级感', '现代', '现代感', '漂亮', '好看', '有质感', '质感', '令人惊艳', '惊艳',
  'premium', 'modern', 'beautiful', 'stunning', 'clean', 'sleek',
]);

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyStringArray = (value) => (
  Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString)
);

function issue(code, path, message) {
  return { code, path, message };
}

function normalizeIdentifier(value) {
  if (!isNonEmptyString(value)) return null;
  const normalized = value.trim().toLowerCase().replace(/[\s_]+/g, '-');
  return identifierAliases.get(normalized) ?? normalized;
}

function normalizedComponentName(value) {
  return String(value ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizedSystem(value) {
  if (isNonEmptyString(value)) return normalizeIdentifier(value);
  if (Array.isArray(value) && value.length === 1 && isNonEmptyString(value[0])) {
    return normalizeIdentifier(value[0]);
  }
  return null;
}

const styleProfileSections = ['shape', 'material', 'interaction'];

function validateStyleDirections(designIntent, errors, warnings) {
  const hasDirections = designIntent.styleDirections !== undefined;
  const hasSelection = designIntent.selectedStyleDirection !== undefined;

  if (!hasDirections && !hasSelection) return;

  if (!Array.isArray(designIntent.styleDirections) || designIntent.styleDirections.length < 2) {
    errors.push(issue(
      'style-directions-required',
      '/designIntent/styleDirections',
      'styleDirections must contain at least two direction candidates.',
    ));
    return;
  }

  const ids = new Map();
  let selected;
  designIntent.styleDirections.forEach((direction, index) => {
    const path = `/designIntent/styleDirections/${index}`;
    if (!isRecord(direction)) {
      errors.push(issue('invalid-style-direction', path, 'Each style direction must be an object.'));
      return;
    }
    for (const field of ['id', 'name', 'description']) {
      if (!isNonEmptyString(direction[field])) {
        errors.push(issue('style-direction-required-field', `${path}/${field}`, `style direction ${field} is required.`));
      }
    }
    const id = isNonEmptyString(direction.id) ? direction.id.trim() : null;
    if (id && ids.has(id)) {
      errors.push(issue('duplicate-style-direction-id', `${path}/id`, `Style direction id duplicates /designIntent/styleDirections/${ids.get(id)}/id.`));
    } else if (id) {
      ids.set(id, index);
    }
    if (!isRecord(direction.profile)) {
      errors.push(issue('style-profile-required', `${path}/profile`, 'Each style direction requires a profile.'));
    } else {
      for (const section of styleProfileSections) {
        if (!isRecord(direction.profile[section]) || Object.keys(direction.profile[section]).length === 0) {
          errors.push(issue('style-profile-required', `${path}/profile/${section}`, `Style profiles require a non-empty ${section} section.`));
        }
      }
    }
    if (direction.id === designIntent.selectedStyleDirection) selected = { direction, index };
  });

  if (!isNonEmptyString(designIntent.selectedStyleDirection)) {
    errors.push(issue('style-direction-selection-required', '/designIntent/selectedStyleDirection', 'selectedStyleDirection is required when styleDirections are provided.'));
  } else if (!selected) {
    errors.push(issue('style-direction-not-found', '/designIntent/selectedStyleDirection', `Selected style direction ${designIntent.selectedStyleDirection} was not found.`));
  } else if (!isRecord(selected.direction.profile)) {
    errors.push(issue('style-profile-required', `/designIntent/styleDirections/${selected.index}/profile`, 'The selected style direction requires a complete profile.'));
  }

  const language = designIntent.visualLanguage;
  if (language !== undefined) {
    if (!isRecord(language)) {
      errors.push(issue('invalid-visual-language', '/designIntent/visualLanguage', 'visualLanguage must be an object.'));
    } else {
      if (!isNonEmptyString(language.sourceDirectionId)) {
        errors.push(issue('visual-language-source-required', '/designIntent/visualLanguage/sourceDirectionId', 'visualLanguage.sourceDirectionId is required.'));
      } else if (language.sourceDirectionId !== designIntent.selectedStyleDirection) {
        errors.push(issue('visual-language-source-mismatch', '/designIntent/visualLanguage/sourceDirectionId', 'visualLanguage.sourceDirectionId must match selectedStyleDirection.'));
      }
      for (const section of styleProfileSections) {
        if (!isRecord(language[section])) warnings.push(issue('visual-language-profile-incomplete', `/designIntent/visualLanguage/${section}`, `visualLanguage should include ${section}.`));
      }
    }
  }
}

function validateQualityMetadata(designIntent, errors, warnings) {
  const evidence = designIntent.evidence;
  if (evidence !== undefined) {
    if (!Array.isArray(evidence)) {
      errors.push(issue('invalid-evidence', '/designIntent/evidence', 'designIntent.evidence must be an array.'));
    } else {
      const ids = new Set();
      evidence.forEach((record, index) => {
        const path = `/designIntent/evidence/${index}`;
        if (!isRecord(record)) {
          errors.push(issue('invalid-evidence-record', path, 'Each evidence record must be an object.'));
          return;
        }
        for (const field of ['id', 'type', 'source', 'claim', 'capturedAt']) {
          if (!isNonEmptyString(record[field])) {
            errors.push(issue('evidence-field-required', `${path}/${field}`, `evidence.${field} is required.`));
          }
        }
        if (isNonEmptyString(record.id)) {
          if (ids.has(record.id.trim())) errors.push(issue('duplicate-evidence-id', `${path}/id`, 'Evidence ids must be unique.'));
          ids.add(record.id.trim());
        }
        if (!['high', 'medium', 'low'].includes(record.confidence)) {
          errors.push(issue('invalid-evidence-confidence', `${path}/confidence`, 'evidence.confidence must be high, medium, or low.'));
        } else if (record.confidence === 'low') {
          warnings.push(issue('low-confidence-evidence', `${path}/confidence`, 'Low-confidence evidence should not override user, brand, or project evidence.'));
        }
        if (record.freshness !== undefined && !['current', 'needs-review', 'historical'].includes(record.freshness)) {
          errors.push(issue('invalid-evidence-freshness', `${path}/freshness`, 'evidence.freshness is invalid.'));
        }
      });
    }
  }

  const tokens = designIntent.tokens;
  if (tokens !== undefined) {
    if (!isRecord(tokens)) errors.push(issue('invalid-tokens', '/designIntent/tokens', 'designIntent.tokens must be an object.'));
    if (isRecord(tokens) && Array.isArray(tokens.radiusTiers) && tokens.radiusTiers.length > 3) {
      warnings.push(issue('too-many-radius-tiers', '/designIntent/tokens/radiusTiers', 'Prefer no more than three primary radius tiers unless the reason is documented.'));
    }
  }

  const responsive = designIntent.responsiveContract;
  if (responsive !== undefined) {
    if (!isRecord(responsive)) errors.push(issue('invalid-responsive-contract', '/designIntent/responsiveContract', 'responsiveContract must be an object.'));
    else {
      for (const field of ['desktop', 'tablet', 'mobile', 'zoomAndReflow']) {
        if (!isNonEmptyString(responsive[field])) warnings.push(issue('responsive-contract-incomplete', `/designIntent/responsiveContract/${field}`, `responsiveContract should define ${field}.`));
      }
      if (!isNonEmptyStringArray(responsive.transformations)) warnings.push(issue('responsive-transformations-missing', '/designIntent/responsiveContract/transformations', 'responsiveContract should list concrete layout transformations.'));
    }
  }

  const budget = designIntent.performanceBudget;
  if (budget !== undefined) {
    if (!isRecord(budget)) errors.push(issue('invalid-performance-budget', '/designIntent/performanceBudget', 'performanceBudget must be an object.'));
    else {
      for (const field of ['motionPolicy', 'fontPolicy']) {
        if (!isNonEmptyString(budget[field])) warnings.push(issue('performance-budget-incomplete', `/designIntent/performanceBudget/${field}`, `performanceBudget should define ${field}.`));
      }
    }
  }

  const qa = designIntent.visualQaTargets;
  if (qa !== undefined) {
    if (!isRecord(qa)) errors.push(issue('invalid-visual-qa-targets', '/designIntent/visualQaTargets', 'visualQaTargets must be an object.'));
    else {
      if (!isNonEmptyStringArray(qa.viewports)) warnings.push(issue('visual-qa-viewports-missing', '/designIntent/visualQaTargets/viewports', 'visualQaTargets should include desktop and mobile viewport targets.'));
      if (qa.reducedMotion !== true) warnings.push(issue('visual-qa-reduced-motion-missing', '/designIntent/visualQaTargets/reducedMotion', 'visualQaTargets should explicitly cover reduced motion.'));
    }
  }
}

function isGenericOnlyGoal(goal) {
  const tokens = goal
    .trim()
    .toLowerCase()
    .split(/[\s,，、/|+&和与]+/)
    .filter((token) => token.length > 0);
  if (tokens.length === 0 || tokens.length > 3) return false;
  return tokens.every((token) => genericEmotionalTerms.has(token));
}

function validateEmotionalIntent(designIntent, errors, warnings) {
  const intent = designIntent.emotionalIntent;
  if (intent === undefined) return;

  if (!isRecord(intent)) {
    errors.push(issue(
      'emotional-intent-invalid',
      '/designIntent/emotionalIntent',
      'designIntent.emotionalIntent must be an object.',
    ));
    return;
  }

  if (!isNonEmptyString(intent.goal)) {
    errors.push(issue(
      'emotional-goal-required',
      '/designIntent/emotionalIntent/goal',
      'emotionalIntent.goal must describe the feeling the page should produce.',
    ));
  } else if (isGenericOnlyGoal(intent.goal)) {
    warnings.push(issue(
      'generic-emotional-goal',
      '/designIntent/emotionalIntent/goal',
      'emotionalIntent.goal is only a generic descriptor; describe the user experience it produces.',
    ));
  }

  if (!isNonEmptyString(intent.rationale)) {
    errors.push(issue(
      'emotional-rationale-required',
      '/designIntent/emotionalIntent/rationale',
      'emotionalIntent.rationale must tie the goal to product, audience, or core task.',
    ));
  }

  const carriers = intent.carriers;
  if (!isRecord(carriers)) {
    errors.push(issue(
      'emotional-carriers-required',
      '/designIntent/emotionalIntent/carriers',
      'emotionalIntent.carriers must name at least one design layer that produces the feeling.',
    ));
  } else {
    const validLayers = Object.entries(carriers).filter(([layer, value]) => (
      emotionalCarrierLayers.has(layer) && isNonEmptyString(value)
    ));
    if (validLayers.length === 0) {
      errors.push(issue(
        'emotional-carriers-required',
        '/designIntent/emotionalIntent/carriers',
        `emotionalIntent.carriers must include at least one of: ${[...emotionalCarrierLayers].join(', ')}.`,
      ));
    }
    for (const layer of Object.keys(carriers)) {
      if (!emotionalCarrierLayers.has(layer)) {
        warnings.push(issue(
          'unknown-emotional-carrier',
          `/designIntent/emotionalIntent/carriers/${layer}`,
          `Unknown carrier layer ${layer}. Use ${[...emotionalCarrierLayers].join(', ')}.`,
        ));
      }
    }
  }

  if (!isNonEmptyStringArray(intent.avoid)) {
    errors.push(issue(
      'emotional-avoid-required',
      '/designIntent/emotionalIntent/avoid',
      'emotionalIntent.avoid must list treatments that would break the intended feeling.',
    ));
  }

  if (!isNonEmptyStringArray(intent.qaQuestions)) {
    errors.push(issue(
      'emotional-qa-required',
      '/designIntent/emotionalIntent/qaQuestions',
      'emotionalIntent.qaQuestions must list observable questions for rendered review.',
    ));
  }

  if (isNonEmptyString(designIntent.selectedStyleDirection) && Array.isArray(designIntent.styleDirections)) {
    const index = designIntent.styleDirections.findIndex((direction) => (
      isRecord(direction) && direction.id === designIntent.selectedStyleDirection
    ));
    if (index >= 0 && !isNonEmptyString(designIntent.styleDirections[index].emotionalEffect)) {
      errors.push(issue(
        'emotional-effect-required',
        `/designIntent/styleDirections/${index}/emotionalEffect`,
        'The selected style direction must state how it supports the emotional goal.',
      ));
    }
  }
}

function validateSystem(value, field, errors, { allowNull = false } = {}) {
  if (allowNull && value === null) return;
  if (isNonEmptyString(value)) return;
  if (Array.isArray(value) && value.length === 1 && isNonEmptyString(value[0])) return;

  errors.push(issue(
    Array.isArray(value) && value.length > 1 ? `multiple-${field}s` : `invalid-${field}`,
    `/${field}`,
    `${field} must be ${allowNull ? 'null, ' : ''}a string, or a single-element array.`,
  ));
}

function validateSelectionSource(source, path, foundation, enhancer, errors) {
  const normalizedSource = normalizeIdentifier(source);
  if (!normalizedSource) return;

  if (knownFoundations.has(normalizedSource) && foundation && normalizedSource !== foundation) {
    errors.push(issue(
      'foundation-source-conflict',
      `${path}/selection/source`,
      `Selection source ${source} conflicts with declared foundation ${foundation}.`,
    ));
  }

  const selectsEnhancerAlias = normalizedSource === 'enhancer';
  const selectsKnownEnhancer = knownEnhancers.has(normalizedSource);
  if ((selectsEnhancerAlias && !enhancer) || (selectsKnownEnhancer && normalizedSource !== enhancer)) {
    errors.push(issue(
      'enhancer-source-conflict',
      `${path}/selection/source`,
      `Selection source ${source} is not the declared enhancer${enhancer ? ` ${enhancer}` : ''}.`,
    ));
  }
}

export function validateComponentPlan(plan, { project } = {}) {
  const errors = [];
  const warnings = [];
  const document = isRecord(plan) ? plan : {};

  if (document.version !== 1) {
    errors.push(issue('invalid-version', '/version', 'version must equal 1.'));
  }

  if (!isRecord(document.designIntent)) {
    errors.push(issue('invalid-design-intent', '/designIntent', 'designIntent must be an object.'));
  } else {
    for (const field of requiredDesignIntentFields) {
      if (!isNonEmptyString(document.designIntent[field])) {
        errors.push(issue('design-intent-field-required', `/designIntent/${field}`, `designIntent.${field} is required.`));
      }
    }
    if (isNonEmptyString(document.designIntent.density) && !validDensities.has(document.designIntent.density)) {
      errors.push(issue(
        'invalid-density',
        '/designIntent/density',
        `designIntent.density must be one of: ${[...validDensities].join(', ')}.`,
      ));
    }
    validateStyleDirections(document.designIntent, errors, warnings);
    validateQualityMetadata(document.designIntent, errors, warnings);
    validateEmotionalIntent(document.designIntent, errors, warnings);
    if (!isNonEmptyStringArray(document.designIntent.principles)) {
      errors.push(issue(
        'design-intent-field-required',
        '/designIntent/principles',
        'designIntent.principles must be a non-empty array of non-empty strings.',
      ));
    }
  }

  validateSystem(document.foundation, 'foundation', errors);
  validateSystem(document.enhancer, 'enhancer', errors, { allowNull: true });
  const foundation = normalizedSystem(document.foundation);
  const enhancer = normalizedSystem(document.enhancer);
  if (enhancer && capabilityLibraries.has(enhancer)) {
    errors.push(issue(
      'capability-library-as-enhancer',
      '/enhancer',
      `${document.enhancer} is a capability library; list it in dependencies, not enhancer.`,
    ));
  }

  if (!Array.isArray(document.dependencies)) {
    errors.push(issue('invalid-dependencies', '/dependencies', 'dependencies must be an array.'));
  } else {
    document.dependencies.forEach((dependency, index) => {
      const dependencyPath = `/dependencies/${index}`;
      if (!isRecord(dependency)) {
        errors.push(issue('invalid-dependency', dependencyPath, 'Each dependency must be an object.'));
        return;
      }
      for (const field of ['name', 'reason']) {
        if (!isNonEmptyString(dependency[field])) {
          errors.push(issue('dependency-field-required', `${dependencyPath}/${field}`, `dependency.${field} is required.`));
        }
      }
      if (typeof dependency.new !== 'boolean') {
        errors.push(issue('dependency-new-required', `${dependencyPath}/new`, 'dependency.new must be a boolean.'));
      }
    });
  }

  if (!Array.isArray(document.regions)) {
    errors.push(issue('invalid-regions', '/regions', 'regions must be an array.'));
  } else {
    const regionIds = new Map();
    document.regions.forEach((region, index) => {
      const regionPath = `/regions/${index}`;
      if (!isRecord(region)) {
        errors.push(issue('invalid-region', regionPath, 'Each region must be an object.'));
        return;
      }

      for (const field of ['id', 'need', 'reason', 'responsive']) {
        if (!isNonEmptyString(region[field])) {
          errors.push(issue('region-field-required', `${regionPath}/${field}`, `region.${field} is required.`));
        }
      }
      if (isNonEmptyString(region.id)) {
        const normalizedId = region.id.trim();
        if (regionIds.has(normalizedId)) {
          errors.push(issue(
            'duplicate-region-id',
            `${regionPath}/id`,
            `region.id duplicates /regions/${regionIds.get(normalizedId)}/id.`,
          ));
        } else {
          regionIds.set(normalizedId, index);
        }
      }

      const capabilitiesValid = isNonEmptyStringArray(region.capabilities);
      const statesValid = isNonEmptyStringArray(region.states);
      const duplicateCapabilities = capabilitiesValid
        ? region.capabilities.filter((capability, index) => region.capabilities.indexOf(capability) !== index)
        : [];
      const unknownCapabilities = capabilitiesValid
        ? region.capabilities.filter((capability) => !canonicalCapabilities.has(capability))
        : [];
      const selectionValid = isRecord(region.selection);
      const accessibilityValid = isRecord(region.accessibility);

      if (!capabilitiesValid) {
        errors.push(issue(
          'invalid-region-capabilities',
          `${regionPath}/capabilities`,
          'region.capabilities must be a non-empty array of non-empty strings.',
        ));
      }
      if (!statesValid) {
        errors.push(issue(
          'invalid-region-states',
          `${regionPath}/states`,
          'region.states must be a non-empty array of non-empty strings.',
        ));
      }
      if (!selectionValid) {
        errors.push(issue('invalid-region-selection', `${regionPath}/selection`, 'region.selection must be an object.'));
      }
      if (!accessibilityValid) {
        errors.push(issue('invalid-region-accessibility', `${regionPath}/accessibility`, 'region.accessibility must be an object.'));
      }
      if (duplicateCapabilities.length > 0) {
        warnings.push(issue(
          'duplicate-capability',
          `${regionPath}/capabilities`,
          `Region capabilities contain duplicate token(s): ${[...new Set(duplicateCapabilities)].join(', ')}.`,
        ));
      }
      if (unknownCapabilities.length > 0) {
        warnings.push(issue(
          'unknown-capability',
          `${regionPath}/capabilities`,
          `Unknown capability token(s): ${[...new Set(unknownCapabilities)].join(', ')}. Use canonical lowercase tokens.`,
        ));
      }

      const selection = selectionValid ? region.selection : {};
      const accessibility = accessibilityValid ? region.accessibility : {};
      const capabilities = capabilitiesValid ? region.capabilities : [];
      const states = statesValid ? region.states : [];

      if (!isNonEmptyString(selection.source)) {
        errors.push(issue('selection-source-required', `${regionPath}/selection/source`, 'selection.source must be a non-empty string.'));
      } else {
        validateSelectionSource(selection.source, regionPath, foundation, enhancer, errors);
      }
      if (!isNonEmptyString(selection.component)) {
        errors.push(issue('selection-component-required', `${regionPath}/selection/component`, 'selection.component must be a non-empty string.'));
      } else if (normalizeIdentifier(selection.source) === 'project' && project) {
        const projectComponents = Array.isArray(project.components) ? project.components : [];
        const componentNames = new Set(projectComponents.map((component) => (
          normalizedComponentName(component?.name ?? component)
        )));
        if (!componentNames.has(normalizedComponentName(selection.component))) {
          errors.push(issue(
            'project-component-not-found',
            `${regionPath}/selection/component`,
            `Project component ${selection.component} was not found in the inspected project.`,
          ));
        }
      }

      if (normalizeIdentifier(selection.source) === 'custom') {
        if (!isNonEmptyString(region.customReason)) {
          errors.push(issue('custom-reason-required', `${regionPath}/customReason`, 'Custom selections require customReason.'));
        }
        if (!isNonEmptyStringArray(region.rejectedCandidates)) {
          errors.push(issue(
            'rejected-candidates-required',
            `${regionPath}/rejectedCandidates`,
            'Custom selections require a non-empty rejectedCandidates string array.',
          ));
        }
      }

      const interactiveImplications = capabilities.filter((capability) => (
        interactiveImplyingCapabilities.has(capability)
      ));
      if (interactiveImplications.length > 0 && !capabilities.includes('interactive')) {
        errors.push(issue(
          'interactive-capability-required',
          `${regionPath}/capabilities`,
          `${interactiveImplications.join(', ')} capabilities require the interactive capability.`,
        ));
      }

      const dataImplications = capabilities.filter((capability) => dataImplyingCapabilities.has(capability));
      if (dataImplications.length > 0 && !capabilities.includes('data')) {
        errors.push(issue(
          'data-capability-required',
          `${regionPath}/capabilities`,
          `${dataImplications.join(', ')} capabilities require the data capability.`,
        ));
      }

      if (capabilities.includes('interactive')) {
        for (const field of ['keyboard', 'focus', 'semantics']) {
          if (!isNonEmptyString(accessibility[field])) {
            errors.push(issue(
              'interactive-accessibility-required',
              `${regionPath}/accessibility/${field}`,
              `Interactive regions require accessibility.${field}.`,
            ));
          }
        }
      }

      if (isRecord(region.dataViz)) {
        for (const field of ['question', 'textAlternative']) {
          if (!isNonEmptyString(region.dataViz[field])) {
            errors.push(issue('data-viz-field-required', `${regionPath}/dataViz/${field}`, `dataViz.${field} is required for chart regions.`));
          }
        }
      }
      if (capabilities.includes('chart') && !isRecord(region.dataViz)) {
        errors.push(issue('data-viz-required', `${regionPath}/dataViz`, 'Chart regions require dataViz metadata with a question and text alternative.'));
      }
      if (isRecord(region.performance) && typeof region.performance.clientOnly !== 'boolean' && region.performance.clientOnly !== undefined) {
        errors.push(issue('invalid-region-performance', `${regionPath}/performance/clientOnly`, 'performance.clientOnly must be a boolean.'));
      }

      if (region.emotionalRole !== undefined && !emotionalRoles.has(region.emotionalRole)) {
        errors.push(issue(
          'invalid-emotional-role',
          `${regionPath}/emotionalRole`,
          `region.emotionalRole must be one of: ${[...emotionalRoles].join(', ')}.`,
        ));
      }
      if (region.emotionalContribution !== undefined && !isNonEmptyString(region.emotionalContribution)) {
        errors.push(issue(
          'invalid-emotional-contribution',
          `${regionPath}/emotionalContribution`,
          'region.emotionalContribution must be a non-empty string when present.',
        ));
      }

      if (statesValid && (capabilities.includes('data') || capabilities.includes('async'))) {
        const missing = asyncStates.filter((state) => !states.includes(state));
        if (missing.length) {
          warnings.push(issue(
            'async-states-incomplete',
            `${regionPath}/states`,
            `Data or async regions should include loading, empty, error, and success states; missing: ${missing.join(', ')}.`,
          ));
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      regionCount: Array.isArray(document.regions) ? document.regions.length : 0,
      errorCount: errors.length,
      warningCount: warnings.length,
    },
  };
}
