import type {
  LanguageRelation,
  LanguageSearchCondition,
  ParsedSearchQuery,
  SearchCondition,
} from '@/lib/gemini/search'

export type MatchLevel =
  | 'direct'
  | 'equivalent'
  | 'close_concept'

export type PublicProfileLanguage = {
  code: string
  nameEn: string
  nameJa: string
  isNative: boolean
  canSpeak: boolean
  isLearning: boolean
  wantsToInteract: boolean
}

export type SearchablePublicProfile = {
  profileId: string
  displayName: string
  studentType: string
  cohortNumber: number | null
  exchangeGradeLevel: string | null
  studentTypeOtherText: string | null
  age: number
  bio: string
  languages: PublicProfileLanguage[]
  tags: string[]
}

export type MatchedCondition = {
  label: string
  source: 'language' | 'tag'
  level: MatchLevel
  matchedValue: string
}

export type ProfileSearchResult =
  SearchablePublicProfile & {
    matchedConditions: MatchedCondition[]
  }

type TermMatch = {
  level: MatchLevel
  matchedValue: string
}

function normalizeText(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('ja')
    .replace(/\s+/g, ' ')
}

function valuesMatch(
  profileValue: string,
  searchTerm: string
) {
  return (
    normalizeText(profileValue) ===
    normalizeText(searchTerm)
  )
}

function findMatchForTerms(
  profileValues: string[],
  directTerms: string[],
  equivalentTerms: string[],
  closeConceptTerms: string[]
): TermMatch | null {
  const termGroups: Array<{
    level: MatchLevel
    terms: string[]
  }> = [
    {
      level: 'direct',
      terms: directTerms,
    },
    {
      level: 'equivalent',
      terms: equivalentTerms,
    },
    {
      level: 'close_concept',
      terms: closeConceptTerms,
    },
  ]

  for (const group of termGroups) {
    for (const profileValue of profileValues) {
      const matched = group.terms.some(
        (term) =>
          valuesMatch(profileValue, term)
      )

      if (matched) {
        return {
          level: group.level,
          matchedValue: profileValue,
        }
      }
    }
  }

  return null
}

function languageMeetsRelation(
  language: PublicProfileLanguage,
  relation: LanguageRelation
) {
  switch (relation) {
    case 'native':
      return language.isNative

    case 'speaking':
      return language.canSpeak

    case 'learning':
      return language.isLearning

    case 'interaction':
      return language.wantsToInteract

    case 'any':
      return true
  }
}

function matchLanguageCondition(
  profile: SearchablePublicProfile,
  condition: LanguageSearchCondition
): MatchedCondition | null {
  const eligibleLanguages =
    profile.languages.filter((language) =>
      languageMeetsRelation(
        language,
        condition.relation
      )
    )

  for (const language of eligibleLanguages) {
    const match = findMatchForTerms(
      [
        language.code,
        language.nameEn,
        language.nameJa,
      ],
      condition.directTerms,
      condition.equivalentTerms,
      condition.closeConceptTerms
    )

    if (match) {
      return {
        label: condition.label,
        source: 'language',
        level: match.level,
        matchedValue: match.matchedValue,
      }
    }
  }

  return null
}

function matchTagCondition(
  profile: SearchablePublicProfile,
  condition: SearchCondition
): MatchedCondition | null {
  const match = findMatchForTerms(
    profile.tags,
    condition.directTerms,
    condition.equivalentTerms,
    condition.closeConceptTerms
  )

  if (!match) {
    return null
  }

  return {
    label: condition.label,
    source: 'tag',
    level: match.level,
    matchedValue: match.matchedValue,
  }
}

function profileMatchesFilters(
  profile: SearchablePublicProfile,
  parsedQuery: ParsedSearchQuery
) {
  const { filters } = parsedQuery

  if (
    filters.ageMin !== null &&
    profile.age < filters.ageMin
  ) {
    return false
  }

  if (
    filters.ageMax !== null &&
    profile.age > filters.ageMax
  ) {
    return false
  }

  if (
    filters.studentTypes.length > 0 &&
    !filters.studentTypes.includes(
      profile.studentType as
        (typeof filters.studentTypes)[number]
    )
  ) {
    return false
  }

  if (
    filters.cohortNumbers.length > 0 &&
    (
      profile.cohortNumber === null ||
      !filters.cohortNumbers.includes(
        profile.cohortNumber
      )
    )
  ) {
    return false
  }

  if (
    filters.exchangeGradeLevels.length >
      0 &&
    (
      !profile.exchangeGradeLevel ||
      !filters.exchangeGradeLevels.some(
        (gradeLevel) =>
          valuesMatch(
            profile.exchangeGradeLevel ?? '',
            gradeLevel
          )
      )
    )
  ) {
    return false
  }

  return true
}

function minimumRequiredMatches(
  conditionCount: number
) {
  switch (conditionCount) {
    case 0:
      return 0

    case 1:
      return 1

    case 2:
      return 1

    case 3:
      return 2

    case 4:
      return 2

    default:
      return 3
  }
}

function matchLevelCounts(
  result: ProfileSearchResult
) {
  return {
    direct: result.matchedConditions.filter(
      (condition) =>
        condition.level === 'direct'
    ).length,
    equivalent:
      result.matchedConditions.filter(
        (condition) =>
          condition.level === 'equivalent'
      ).length,
    closeConcept:
      result.matchedConditions.filter(
        (condition) =>
          condition.level ===
          'close_concept'
      ).length,
  }
}

export function hasEffectiveSearchCriteria(
  parsedQuery: ParsedSearchQuery
) {
  const { filters } = parsedQuery

  return (
    parsedQuery.languageConditions.length >
      0 ||
    parsedQuery.tagConditions.length > 0 ||
    filters.ageMin !== null ||
    filters.ageMax !== null ||
    filters.studentTypes.length > 0 ||
    filters.cohortNumbers.length > 0 ||
    filters.exchangeGradeLevels.length > 0
  )
}

export function matchPublicProfiles(
  profiles: SearchablePublicProfile[],
  parsedQuery: ParsedSearchQuery
): ProfileSearchResult[] {
  const totalConditionCount =
    parsedQuery.languageConditions.length +
    parsedQuery.tagConditions.length

  const requiredMatchCount =
    minimumRequiredMatches(
      totalConditionCount
    )

  const results = profiles
    .filter((profile) =>
      profileMatchesFilters(
        profile,
        parsedQuery
      )
    )
    .map((profile) => {
      const languageMatches =
        parsedQuery.languageConditions
          .map((condition) =>
            matchLanguageCondition(
              profile,
              condition
            )
          )
          .filter(
            (
              condition
            ): condition is MatchedCondition =>
              condition !== null
          )

      const tagMatches =
        parsedQuery.tagConditions
          .map((condition) =>
            matchTagCondition(
              profile,
              condition
            )
          )
          .filter(
            (
              condition
            ): condition is MatchedCondition =>
              condition !== null
          )

      return {
        ...profile,
        matchedConditions: [
          ...languageMatches,
          ...tagMatches,
        ],
      }
    })
    .filter(
      (result) =>
        result.matchedConditions.length >=
        requiredMatchCount
    )

  results.sort((left, right) => {
    const conditionCountDifference =
      right.matchedConditions.length -
      left.matchedConditions.length

    if (conditionCountDifference !== 0) {
      return conditionCountDifference
    }

    const leftCounts =
      matchLevelCounts(left)
    const rightCounts =
      matchLevelCounts(right)

    const directDifference =
      rightCounts.direct -
      leftCounts.direct

    if (directDifference !== 0) {
      return directDifference
    }

    const equivalentDifference =
      rightCounts.equivalent -
      leftCounts.equivalent

    if (equivalentDifference !== 0) {
      return equivalentDifference
    }

    const closeConceptDifference =
      rightCounts.closeConcept -
      leftCounts.closeConcept

    if (closeConceptDifference !== 0) {
      return closeConceptDifference
    }

    return left.displayName.localeCompare(
      right.displayName,
      'ja'
    )
  })

  return results.slice(0, 10)
}