const ANSWER_VALUE_MAP = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  F: 1,
  G: 2,
  H: 3,
  J: 4,
};

const PRACTICE_TEST_1_NAME_PATTERN =
  /\b(p1|pt\s*0*1|practice\s*test\s*0*1)\b/i;

function buildRawToScale(entries) {
  return Object.fromEntries(entries);
}

function createSectionConfig({
  title,
  entries,
  notScored,
  rawToScale,
  categoryDisplayNames,
  categoryOrder,
  groupedCategories = {},
}) {
  const answerKey = {};
  const categoryByQuestion = {};
  const categoryTotals = {};

  entries.forEach(([questionNumber, answer, categoryCode]) => {
    answerKey[questionNumber] = ANSWER_VALUE_MAP[answer];

    if (categoryCode) {
      categoryByQuestion[questionNumber] = categoryCode;
      categoryTotals[categoryCode] = (categoryTotals[categoryCode] || 0) + 1;
    }
  });

  const groupedCategoryTotals = Object.fromEntries(
    Object.entries(groupedCategories).map(([groupCode, memberCodes]) => [
      groupCode,
      memberCodes.reduce(
        (total, memberCode) => total + (categoryTotals[memberCode] || 0),
        0
      ),
    ])
  );

  return {
    title,
    answerKey,
    categoryByQuestion,
    notScored: new Set(notScored),
    rawToScale,
    totalPossible: entries.length,
    categoryDisplayNames,
    categoryTotals,
    categoryOrder,
    groupedCategories,
    groupedCategoryTotals,
  };
}

function normalizeAnswer(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1 && value <= 4 ? value : null;
  }

  const cleaned = String(value).trim().toUpperCase();
  if (!cleaned || cleaned === "-" || cleaned === "NULL") {
    return null;
  }

  if (ANSWER_VALUE_MAP[cleaned]) {
    return ANSWER_VALUE_MAP[cleaned];
  }

  const numericValue = Number(cleaned);
  return Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 4
    ? numericValue
    : null;
}

function getStudentAnswer(studentAnswers, questionNumber) {
  if (Array.isArray(studentAnswers)) {
    return normalizeAnswer(studentAnswers[questionNumber - 1]);
  }

  if (studentAnswers && typeof studentAnswers === "object") {
    return normalizeAnswer(
      studentAnswers[questionNumber] ?? studentAnswers[String(questionNumber)]
    );
  }

  return null;
}

export function matchesPracticeTest1(testName) {
  return PRACTICE_TEST_1_NAME_PATTERN.test(String(testName || ""));
}

export function scoreSection(studentAnswers, config) {
  const categoryScores = Object.fromEntries(
    Object.keys(config.categoryTotals).map((categoryCode) => [
      categoryCode,
      {
        correct: 0,
        total: config.categoryTotals[categoryCode],
      },
    ])
  );

  const questionResults = [];
  let rawScore = 0;

  Object.keys(config.answerKey)
    .map(Number)
    .sort((left, right) => left - right)
    .forEach((questionNumber) => {
      const expectedAnswer = config.answerKey[questionNumber];
      const studentAnswer = getStudentAnswer(studentAnswers, questionNumber);
      const isCorrect = studentAnswer !== null && studentAnswer === expectedAnswer;
      const categoryCode = config.categoryByQuestion[questionNumber] || null;

      if (isCorrect) {
        rawScore += 1;
      }

      if (categoryCode && isCorrect) {
        categoryScores[categoryCode].correct += 1;
      }

      questionResults.push({
        questionNumber,
        expectedAnswer,
        studentAnswer,
        categoryCode,
        isCorrect,
        isNotScored: false,
      });
    });

  Array.from(config.notScored)
    .sort((left, right) => left - right)
    .forEach((questionNumber) => {
      questionResults.push({
        questionNumber,
        expectedAnswer: null,
        studentAnswer: getStudentAnswer(studentAnswers, questionNumber),
        categoryCode: null,
        isCorrect: false,
        isNotScored: true,
      });
    });

  const groupedCategoryScores = Object.fromEntries(
    Object.entries(config.groupedCategories).map(([groupCode, memberCodes]) => [
      groupCode,
      {
        correct: memberCodes.reduce(
          (total, memberCode) => total + (categoryScores[memberCode]?.correct || 0),
          0
        ),
        total: config.groupedCategoryTotals[groupCode] || 0,
      },
    ])
  );

  const scaleScore = config.rawToScale[rawScore];
  if (scaleScore === undefined) {
    throw new Error(
      `${config.title} raw-to-scale table is missing a value for raw score ${rawScore}.`
    );
  }

  return {
    rawScore,
    scaleScore,
    totalPossible: config.totalPossible,
    categoryScores,
    groupedCategoryScores,
    questionResults: questionResults.sort(
      (left, right) => left.questionNumber - right.questionNumber
    ),
  };
}

export const PRACTICE_TEST_1_SCORING = {
  english: createSectionConfig({
    title: "English",
    entries: [
      [1, "C", "CSE"],
      [2, "G", "CSE"],
      [3, "A", "POW"],
      [4, "F", "POW"],
      [5, "A", "CSE"],
      [6, "F", "KLA"],
      [7, "D", "KLA"],
      [8, "J", "CSE"],
      [9, "B", "CSE"],
      [10, "G", "KLA"],
      [11, "B", "CSE"],
      [12, "J", "CSE"],
      [13, "C", "KLA"],
      [14, "H", "POW"],
      [15, "D", "POW"],
      [16, "J", "CSE"],
      [17, "D", "KLA"],
      [18, "H", "POW"],
      [19, "A", "KLA"],
      [20, "J", "POW"],
      [21, "A", "CSE"],
      [22, "F", "CSE"],
      [23, "C", "POW"],
      [24, "H", "POW"],
      [25, "D", "POW"],
      [26, "G", "POW"],
      [27, "D", "CSE"],
      [28, "F", "CSE"],
      [29, "A", "CSE"],
      [30, "G", "POW"],
      [31, "C", "CSE"],
      [32, "F", "POW"],
      [33, "A", "CSE"],
      [34, "H", "KLA"],
      [35, "A", "POW"],
      [36, "G", "POW"],
      [37, "B", "POW"],
      [38, "H", "CSE"],
      [39, "D", "KLA"],
      [40, "J", "CSE"],
    ],
    notScored: [41, 42, 43, 44, 45, 46, 47, 48, 49, 50],
    rawToScale: buildRawToScale([
      [40, 36],
      [39, 35],
      [38, 35],
      [37, 33],
      [36, 31],
      [35, 29],
      [34, 28],
      [33, 27],
      [32, 26],
      [31, 25],
      [30, 24],
      [29, 23],
      [28, 22],
      [27, 22],
      [26, 21],
      [25, 20],
      [24, 20],
      [23, 19],
      [22, 18],
      [21, 17],
      [20, 16],
      [19, 15],
      [18, 15],
      [17, 14],
      [16, 13],
      [15, 13],
      [14, 12],
      [13, 11],
      [12, 11],
      [11, 10],
      [10, 10],
      [9, 10],
      [8, 9],
      [7, 8],
      [6, 7],
      [5, 7],
      [4, 6],
      [3, 5],
      [2, 3],
      [1, 2],
      [0, 1],
    ]),
    categoryDisplayNames: {
      POW: "Production of Writing",
      KLA: "Knowledge of Language",
      CSE: "Conventions of Standard English",
    },
    categoryOrder: ["POW", "KLA", "CSE"],
  }),
  math: createSectionConfig({
    title: "Math",
    entries: [
      [1, "D", "IES"],
      [2, "J", "S"],
      [3, "B", "IES"],
      [4, "F", "IES"],
      [5, "C", "A"],
      [6, "J", "N"],
      [8, "H", "N"],
      [9, "D", "A"],
      [10, "H", "IES"],
      [11, "B", "IES"],
      [12, "J", "S"],
      [13, "A", "G"],
      [14, "J", "IES"],
      [15, "A", "A"],
      [17, "A", "A"],
      [18, "J", "N"],
      [19, "B", "F"],
      [20, "H", "G"],
      [21, "C", "IES"],
      [22, "G", "IES"],
      [23, "C", "F"],
      [24, "G", "F"],
      [25, "A", "F"],
      [26, "G", "A"],
      [27, "B", "S"],
      [28, "F", "G"],
      [30, "J", "G"],
      [31, "C", "G"],
      [32, "J", "IES"],
      [33, "C", "IES"],
      [34, "G", "IES"],
      [35, "C", "IES"],
      [36, "J", "S"],
      [37, "C", "A"],
      [38, "J", "IES"],
      [39, "C", "S"],
      [41, "D", "IES"],
      [42, "F", "IES"],
      [43, "C", "IES"],
      [44, "J", "F"],
      [45, "A", "S"],
    ],
    notScored: [7, 16, 29, 40],
    rawToScale: buildRawToScale([
      [41, 36],
      [40, 36],
      [39, 35],
      [38, 34],
      [37, 34],
      [36, 33],
      [35, 32],
      [34, 31],
      [33, 30],
      [32, 29],
      [31, 29],
      [30, 28],
      [29, 27],
      [28, 27],
      [27, 26],
      [26, 25],
      [25, 24],
      [24, 23],
      [23, 22],
      [22, 21],
      [21, 20],
      [20, 19],
      [19, 19],
      [18, 18],
      [17, 17],
      [16, 17],
      [15, 17],
      [14, 16],
      [13, 16],
      [12, 15],
      [11, 15],
      [10, 15],
      [9, 14],
      [8, 14],
      [7, 13],
      [6, 13],
      [5, 12],
      [4, 11],
      [3, 9],
      [2, 7],
      [1, 5],
      [0, 1],
    ]),
    categoryDisplayNames: {
      PHM: "Preparing for Higher Math",
      IES: "Integrating Essential Skills",
      A: "Algebra",
      F: "Functions",
      G: "Geometry",
      N: "Number & Quantity",
      S: "Statistics & Probability",
    },
    categoryOrder: ["PHM", "IES", "A", "F", "G", "N", "S"],
    groupedCategories: {
      PHM: ["A", "F", "G", "N", "S"],
    },
  }),
  reading: createSectionConfig({
    title: "Reading",
    entries: [
      [10, "J", "CS"],
      [11, "B", "KID"],
      [12, "H", "KID"],
      [13, "B", "CS"],
      [14, "J", "CS"],
      [15, "C", "KID"],
      [16, "J", "KID"],
      [17, "C", "CS"],
      [18, "F", "CS"],
      [19, "B", "KID"],
      [20, "H", "CS"],
      [21, "D", "KID"],
      [22, "H", "KID"],
      [23, "A", "KID"],
      [24, "H", "KID"],
      [25, "D", "IKI"],
      [26, "F", "IKI"],
      [27, "B", "IKI"],
      [28, "J", "IKI"],
      [29, "D", "KID"],
      [30, "F", "CS"],
      [31, "A", "KID"],
      [32, "G", "CS"],
      [33, "C", "KID"],
      [34, "J", "IKI"],
      [35, "B", "KID"],
      [36, "H", "CS"],
    ],
    notScored: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    rawToScale: buildRawToScale([
      [27, 36],
      [26, 35],
      [25, 34],
      [24, 32],
      [23, 30],
      [22, 28],
      [21, 26],
      [20, 25],
      [19, 24],
      [18, 23],
      [17, 22],
      [16, 21],
      [15, 20],
      [14, 18],
      [13, 17],
      [12, 16],
      [11, 15],
      [10, 14],
      [9, 13],
      [8, 12],
      [7, 12],
      [6, 11],
      [5, 10],
      [4, 9],
      [3, 7],
      [2, 5],
      [1, 3],
      [0, 1],
    ]),
    categoryDisplayNames: {
      KID: "Key Ideas & Details",
      CS: "Craft & Structure",
      IKI: "Integration of Knowledge & Ideas",
    },
    categoryOrder: ["KID", "CS", "IKI"],
  }),
  science: createSectionConfig({
    title: "Science",
    entries: [
      [1, "A", "IOD"],
      [2, "F", "IOD"],
      [3, "D", "IOD"],
      [4, "H", "IOD"],
      [5, "D", "EMI"],
      [6, "F", "EMI"],
      [7, "C", "EMI"],
      [8, "J", "IOD"],
      [9, "C", "EMI"],
      [10, "F", "EMI"],
      [11, "C", "EMI"],
      [12, "G", "EMI"],
      [13, "C", "EMI"],
      [14, "H", "SIN"],
      [15, "B", "SIN"],
      [16, "H", "SIN"],
      [17, "B", "SIN"],
      [18, "F", "SIN"],
      [19, "D", "SIN"],
      [20, "F", "EMI"],
      [21, "C", "SIN"],
      [22, "J", "IOD"],
      [23, "C", "SIN"],
      [24, "J", "IOD"],
      [25, "B", "IOD"],
      [26, "J", "IOD"],
      [27, "D", "IOD"],
      [28, "G", "IOD"],
      [35, "B", "IOD"],
      [36, "F", "SIN"],
      [37, "B", "IOD"],
      [38, "G", "IOD"],
      [39, "C", "IOD"],
      [40, "J", "IOD"],
    ],
    notScored: [29, 30, 31, 32, 33, 34],
    rawToScale: buildRawToScale([
      [34, 36],
      [33, 35],
      [32, 34],
      [31, 33],
      [30, 32],
      [29, 31],
      [28, 30],
      [27, 29],
      [26, 28],
      [25, 27],
      [24, 26],
      [23, 25],
      [22, 25],
      [21, 24],
      [20, 23],
      [19, 23],
      [18, 22],
      [17, 21],
      [16, 20],
      [15, 19],
      [14, 18],
      [13, 18],
      [12, 17],
      [11, 16],
      [10, 15],
      [9, 14],
      [8, 12],
      [7, 12],
      [6, 11],
      [5, 10],
      [4, 9],
      [3, 7],
      [2, 6],
      [1, 3],
      [0, 1],
    ]),
    categoryDisplayNames: {
      IOD: "Interpretation of Data",
      SIN: "Scientific Investigation",
      EMI: "Evaluation of Models, Inferences & Experimental Results",
    },
    categoryOrder: ["IOD", "SIN", "EMI"],
  }),
};

export function scorePracticeTest1(resultsBySection) {
  return Object.fromEntries(
    Object.entries(PRACTICE_TEST_1_SCORING).map(([sectionKey, config]) => [
      sectionKey,
      scoreSection(resultsBySection?.[sectionKey], config),
    ])
  );
}
