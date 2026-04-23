import { PRACTICE_TEST_1_SCORING } from "./actPracticeTest1Scoring.js";
import { STUDY_RECOMMENDATION_RULES } from "./studyRecommendationRules.js";

function getBandForScore(bands = [], correct) {
  return (
    bands.find(({ min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY }) =>
      correct >= min && correct <= max
    ) || null
  );
}

function getFallbackReason(reasons = {}, percent = 0) {
  if (percent < 0.5) {
    return reasons.low || "";
  }

  if (percent < 0.85) {
    return reasons.medium || reasons.low || "";
  }

  return reasons.high || reasons.medium || reasons.low || "";
}

function getCategoryScore(sectionScore, sectionConfig, categoryCode) {
  if (!sectionScore || !sectionConfig) {
    return null;
  }

  if (sectionConfig.groupedCategories?.[categoryCode]) {
    return sectionScore.groupedCategoryScores?.[categoryCode] || null;
  }

  return sectionScore.categoryScores?.[categoryCode] || null;
}

export function getCategoryRecommendations(sectionKey, categoryCode, correct, total) {
  const sectionRules = STUDY_RECOMMENDATION_RULES[sectionKey];
  const categoryRules = sectionRules?.categories?.[categoryCode];
  const sectionConfig = PRACTICE_TEST_1_SCORING[sectionKey];
  const label =
    sectionConfig?.categoryDisplayNames?.[categoryCode] || categoryCode;

  if (!categoryRules || !total) {
    return null;
  }

  const percent = total > 0 ? correct / total : 0;
  const band = getBandForScore(categoryRules.bands, correct);
  if (!band) {
    return null;
  }

  const priority = band.priority || (percent < 0.5 ? "high" : percent < 0.85 ? "medium" : "low");
  const reason = band.reason || getFallbackReason(categoryRules.reasons, percent);

  return {
    code: categoryCode,
    label,
    score: {
      correct,
      total,
      percent,
    },
    reason,
    priority,
    isFocusArea: priority === "high",
    recommendations: band.items.map((item) => ({
      ...item,
      priority,
    })),
  };
}

export function generateRecommendations(scoredResults) {
  if (!scoredResults || typeof scoredResults !== "object") {
    return {};
  }

  return Object.entries(STUDY_RECOMMENDATION_RULES).reduce(
    (allSections, [sectionKey, sectionRules]) => {
      const sectionScore = scoredResults[sectionKey];
      const sectionConfig = PRACTICE_TEST_1_SCORING[sectionKey];

      if (!sectionScore || !sectionConfig) {
        return allSections;
      }

      const categories = (sectionRules.order || Object.keys(sectionRules.categories))
        .map((categoryCode, index) => {
          const score = getCategoryScore(sectionScore, sectionConfig, categoryCode);
          if (!score) {
            return null;
          }

          const recommendation = getCategoryRecommendations(
            sectionKey,
            categoryCode,
            score.correct,
            score.total
          );

          if (!recommendation) {
            return null;
          }

          return {
            ...recommendation,
            sortIndex: index,
          };
        })
        .filter(Boolean)
        .sort((left, right) => {
          if (left.score.percent !== right.score.percent) {
            return left.score.percent - right.score.percent;
          }

          return left.sortIndex - right.sortIndex;
        })
        .map(({ sortIndex, ...category }) => category);

      allSections[sectionKey] = {
        title: sectionConfig.title,
        strategy: [...sectionRules.strategy],
        categories,
      };

      return allSections;
    },
    {}
  );
}
