function moduleItem(id, title, subtitle) {
  return {
    id,
    title,
    subtitle,
  };
}

export const STUDY_RECOMMENDATION_RULES = {
  english: {
    order: ["POW", "KLA", "CSE"],
    strategy: [
      moduleItem("eng-strategy-intro", "Introduction to ACT English"),
    ],
    categories: {
      POW: {
        reasons: {
          low: "Your POW score suggests you should reinforce transitions, writer's purpose, and organization choices across the section.",
          medium:
            "Your POW score is developing, so targeted structure and revision practice should help convert more of these questions.",
          high: "Your POW score is already strong; these modules focus on refinement and perfect-scorer style polish.",
        },
        bands: [
          {
            items: [
              moduleItem(
                "eng-pow-perfect",
                "Who Wants to Be a Perfect Scorer? English Edition",
                "Miscellaneous"
              ),
              moduleItem(
                "eng-pow-add-delete",
                "Stop the Presses!",
                "Addition & Deletion"
              ),
              moduleItem(
                "eng-pow-transitions",
                "Fly Swatting Transitions",
                "Transitions"
              ),
              moduleItem(
                "eng-pow-writers-goal",
                "Evaluating a Writer's Goal",
                "Writer's Goal"
              ),
              moduleItem(
                "eng-pow-placement",
                "College Placement",
                "Placement"
              ),
            ],
          },
        ],
      },
      KLA: {
        reasons: {
          low: "Your KLA score points to sentence efficiency and style as a useful focus area.",
          medium:
            "Your KLA score is in a workable range, and concision practice should help tighten this category.",
          high: "Your KLA score is solid; a concise style refresher should help keep it there.",
        },
        bands: [
          {
            items: [
              moduleItem(
                "eng-kla-concision",
                "One KISS Is All It Takes",
                "Concision"
              ),
            ],
          },
        ],
      },
      CSE: {
        bands: [
          {
            max: 8,
            priority: "high",
            reason:
              "Your CSE score suggests you should reinforce grammar and punctuation fundamentals first.",
            items: [
              moduleItem(
                "eng-cse-parts",
                "Parts of Speech: The Building Blocks",
                "Parts of Speech"
              ),
              moduleItem(
                "eng-cse-clauses",
                "Holidays with the Clauses",
                "Independent/Dependent Clauses"
              ),
              moduleItem(
                "eng-cse-punctuation",
                "Punctuation Fashion Show",
                "Punctuation"
              ),
            ],
          },
          {
            min: 9,
            max: 16,
            priority: "medium",
            reason:
              "Your CSE score is mid-range, so we’re recommending sentence structure, punctuation, and usage modules next.",
            items: [
              moduleItem(
                "eng-cse-pronouns-1",
                "Pronouns Save the Day",
                "Pronouns I"
              ),
              moduleItem(
                "eng-cse-pronouns-2",
                "The Often Forgotten Pronouns",
                "Pronouns II"
              ),
              moduleItem(
                "eng-cse-verbs",
                "Who Runs the World? Verbs",
                "Tenses"
              ),
              moduleItem(
                "eng-cse-subject-verb",
                "Subject & Verb Agreement Ain't Always Easy",
                "Subject & Verb Agreement"
              ),
              moduleItem(
                "eng-cse-prepositions",
                "Pesky Prepositions",
                "Prepositions"
              ),
              moduleItem(
                "eng-cse-parenthetical",
                "Parenthetical Problems",
                "Parentheticals"
              ),
              moduleItem(
                "eng-cse-commas",
                "The 5 Comma Rights",
                "Commas"
              ),
              moduleItem(
                "eng-cse-possessives",
                "Possession of Possessives",
                "Possessives"
              ),
            ],
          },
          {
            min: 17,
            priority: "low",
            reason:
              "Your CSE score is already strong, so we’re keeping the recommendation list short and advanced.",
            items: [
              moduleItem(
                "eng-cse-comparison",
                "Apples to Apples",
                "Comparison/Parallelism"
              ),
              moduleItem(
                "eng-cse-modifiers",
                "Smiling Away Dangling Modifiers",
                "Modifiers"
              ),
              moduleItem(
                "eng-cse-perfect",
                "Who Wants to Be a Perfect Scorer? English Edition",
                "Miscellaneous"
              ),
            ],
          },
        ],
      },
    },
  },
  math: {
    order: ["IES", "A", "F", "G", "N", "S"],
    strategy: [
      moduleItem("math-strategy-intro", "Introduction to ACT Math"),
      moduleItem(
        "math-strategy-methodology",
        "Masked Math-odology",
        "Strategies"
      ),
      moduleItem(
        "math-strategy-modeling",
        "The Real Models of Algebraland",
        "Modeling"
      ),
    ],
    categories: {
      N: {
        bands: [
          {
            max: 3,
            priority: "high",
            reason:
              "Your Number & Quantity score suggests foundational number sense should be the first repair target.",
            items: [
              moduleItem(
                "math-n-factors",
                "Spicy Number Recipes",
                "Factors & Multiples"
              ),
              moduleItem(
                "math-n-fractions-1",
                "Partiala Jones the Fractional Explorer",
                "Fractions"
              ),
              moduleItem(
                "math-n-fractions-2",
                "The Partial Fashion Show",
                "Fractions, Decimals, Percentages"
              ),
              moduleItem(
                "math-n-mental",
                "Mental Mathemagic",
                "Mental Math"
              ),
            ],
          },
          {
            min: 4,
            priority: "low",
            reason:
              "Your Number & Quantity score is solid, so we’re shifting toward higher-difficulty and cleanup modules.",
            items: [
              moduleItem(
                "math-n-imaginary",
                "Imaginary Friends",
                "Imaginary Numbers"
              ),
              moduleItem(
                "math-n-perfect",
                "Who Wants to Be a Perfect Scorer? Math Edition",
                "Miscellaneous"
              ),
            ],
          },
        ],
      },
      A: {
        bands: [
          {
            max: 2,
            priority: "high",
            reason:
              "Your Algebra score suggests you should rebuild core equation and expression skills before moving on.",
            items: [
              moduleItem(
                "math-a-pemdas",
                "Dr. PEMDAS",
                "Order of Operations"
              ),
              moduleItem(
                "math-a-basics",
                "Tourists in Algebraland",
                "Algebra Basics"
              ),
              moduleItem(
                "math-a-isolating",
                "A Variable in Distress",
                "Isolating Variables"
              ),
              moduleItem(
                "math-a-proportions",
                "The Wizardry of Pro-Potions",
                "Proportions"
              ),
              moduleItem(
                "math-a-radicals",
                "Radical Randy",
                "Radicals"
              ),
            ],
          },
          {
            min: 3,
            max: 5,
            priority: "medium",
            reason:
              "Your Algebra score is mid-range, so the next step is multi-step algebra, systems, and quadratic fluency.",
            items: [
              moduleItem(
                "math-a-logs",
                "Expo Warriors and Logs with Bae",
                "Exponents, Logarithms"
              ),
              moduleItem(
                "math-a-slopes-1",
                "Out on the Slopes Pt. 1",
                "Line Equations/Slopes"
              ),
              moduleItem(
                "math-a-distance",
                "The Good Ship Prepmedian",
                "Distance, Midpoint, Transformations I"
              ),
              moduleItem(
                "math-a-slopes-2",
                "Out on the Slopes Pt. 2",
                "Systems of Equations"
              ),
              moduleItem(
                "math-a-inequalities",
                "The V Clinic",
                "Inequalities, Absolute Value"
              ),
              moduleItem(
                "math-a-binomials",
                "F.O.I.L.",
                "Multiplying Binomials"
              ),
              moduleItem(
                "math-a-quadratics",
                "Drake: The Original Alge-bruh",
                "D.O.T.S., Quadratic Formula"
              ),
            ],
          },
          {
            min: 6,
            priority: "low",
            reason:
              "Your Algebra score is stronger, so we’re recommending advanced-only modules.",
            items: [
              moduleItem(
                "math-a-sequences",
                "Gary Vee the Value Adder",
                "Sequences, Series"
              ),
              moduleItem(
                "math-a-perfect",
                "Who Wants to Be a Perfect Scorer? Math Edition",
                "Miscellaneous"
              ),
              moduleItem(
                "math-a-combinatorics",
                "Prepmedians Prom Pt. 1",
                "Combinatorics"
              ),
            ],
          },
        ],
      },
      F: {
        bands: [
          {
            max: 4,
            priority: "high",
            reason:
              "Your Functions score suggests you should reinforce graph reading and transformation basics first.",
            items: [
              moduleItem(
                "math-f-distance",
                "The Good Ship Prepmedian",
                "Distance, Midpoint, Transformations I"
              ),
              moduleItem(
                "math-f-graphs",
                "D.A.N.K.: Data Analysts of Necessary Knowledge",
                "Graphs"
              ),
            ],
          },
          {
            min: 5,
            priority: "low",
            reason:
              "Your Functions score is already solid, so we’re recommending advanced function and graph modules only.",
            items: [
              moduleItem(
                "math-f-functions-1",
                "The Mustachinator Filter",
                "Functions I"
              ),
              moduleItem(
                "math-f-functions-2",
                "Code Breakers",
                "Functions II"
              ),
              moduleItem(
                "math-f-parabolas",
                "Promposals 101",
                "Parabolas"
              ),
              moduleItem(
                "math-f-polynomial",
                "Prepmedians Prom Pt. 2",
                "Polynomial Graphs, Transformations II"
              ),
            ],
          },
        ],
      },
      G: {
        bands: [
          {
            max: 2,
            priority: "high",
            reason:
              "Your Geometry score shows the biggest gains should come from core shapes, triangles, and circles practice.",
            items: [
              moduleItem(
                "math-g-triangles-1",
                "A Day in the Life of a Right Angle",
                "Triangles I"
              ),
              moduleItem(
                "math-g-quads",
                "360andMe",
                "Quadrilaterals"
              ),
              moduleItem(
                "math-g-circles-1",
                "Ja-circles",
                "Circles"
              ),
            ],
          },
          {
            min: 3,
            max: 5,
            priority: "medium",
            reason:
              "Your Geometry score is in the middle band, so trigonometry and second-level triangle work are the next step.",
            items: [
              moduleItem(
                "math-g-triangles-2",
                "Back to Righty",
                "Triangles II, Trigonometry I"
              ),
            ],
          },
          {
            min: 6,
            priority: "low",
            reason:
              "Your Geometry score is strong, so we’re keeping the plan focused on advanced geometry and trig topics.",
            items: [
              moduleItem(
                "math-g-trig-2",
                "Trig Noir",
                "Trigonometry II"
              ),
              moduleItem(
                "math-g-arcs",
                "Post-it's Pizzeria",
                "Arcs & Sectors"
              ),
              moduleItem(
                "math-g-conics",
                "Spaceship Prepmedia",
                "Circles, Ellipses, Hyperbolas"
              ),
              moduleItem(
                "math-g-volume",
                "The Height Master",
                "3D Volume"
              ),
            ],
          },
        ],
      },
      S: {
        reasons: {
          low: "Your Statistics & Probability score points to data and probability fundamentals as a good place to tighten up.",
          medium:
            "Your Statistics & Probability score is workable, and targeted practice can make this category steadier.",
          high: "Your Statistics & Probability score is in good shape; these modules help keep it there.",
        },
        bands: [
          {
            items: [
              moduleItem(
                "math-s-statistics",
                "Social Prepmedia Statistics",
                "Statistics"
              ),
              moduleItem(
                "math-s-probability",
                "High Stakes Go Fish",
                "Probability"
              ),
            ],
          },
        ],
      },
      IES: {
        bands: [
          {
            max: 8,
            priority: "high",
            reason:
              "Your IES score suggests reinforcing everyday math fluency and core geometry ideas first.",
            items: [
              moduleItem(
                "math-ies-fractions-1",
                "Partiala Jones the Fractional Explorer",
                "Fractions"
              ),
              moduleItem(
                "math-ies-fractions-2",
                "The Partial Fashion Show",
                "Fractions, Decimals, Percentages"
              ),
              moduleItem(
                "math-ies-proportions",
                "The Wizardry of Pro-Potions",
                "Proportions"
              ),
              moduleItem(
                "math-ies-triangles",
                "A Day in the Life of a Right Angle",
                "Triangles I"
              ),
              moduleItem(
                "math-ies-quads",
                "360andMe",
                "Quadrilaterals"
              ),
              moduleItem(
                "math-ies-circles",
                "Ja-circles",
                "Circles"
              ),
            ],
          },
          {
            min: 9,
            max: 16,
            priority: "medium",
            reason:
              "Your IES score is mid-range, so data interpretation and statistics are the cleanest next gains.",
            items: [
              moduleItem(
                "math-ies-statistics",
                "Social Prepmedia Statistics",
                "Statistics"
              ),
            ],
          },
          {
            min: 17,
            priority: "low",
            reason:
              "Your IES score is already strong, so we’re recommending one higher-level geometry cleanup module.",
            items: [
              moduleItem(
                "math-ies-volume",
                "The Height Master",
                "3D Volume"
              ),
            ],
          },
        ],
      },
    },
  },
  reading: {
    order: ["KID", "CS", "IKI"],
    strategy: [
      moduleItem("read-strategy-intro", "Introduction to ACT Reading"),
      moduleItem(
        "read-strategy-fundamentals",
        "Once upon a Reading Strategy",
        "Reading Fundamentals"
      ),
      moduleItem(
        "read-strategy-types",
        "Where's Waldo vs. Why Waldo?",
        "ACT Question Types"
      ),
      moduleItem(
        "read-strategy-perfect",
        "Who Wants to Be a Perfect Scorer? Reading Edition",
        "Miscellaneous"
      ),
      moduleItem(
        "read-strategy-traps",
        "Love your Answer",
        "Answer Traps"
      ),
    ],
    categories: {
      KID: {
        bands: [
          {
            max: 12,
            priority: "high",
            reason:
              "Your KID score suggests the biggest gains will come from passage comprehension and evidence-finding fundamentals.",
            items: [
              moduleItem(
                "read-kid-fundamentals",
                "Once upon a Reading Strategy",
                "Reading Fundamentals"
              ),
            ],
          },
          {
            min: 13,
            priority: "low",
            reason:
              "Your KID score is already strong, so we’re keeping the plan focused on higher-level ACT reading strategy.",
            items: [
              moduleItem(
                "read-kid-types",
                "Where's Waldo vs. Why Waldo?",
                "ACT Question Types"
              ),
              moduleItem(
                "read-kid-perfect",
                "Who Wants to Be a Perfect Scorer? Reading Edition",
                "Miscellaneous"
              ),
            ],
          },
        ],
      },
      CS: {
        bands: [
          {
            max: 5,
            priority: "high",
            reason:
              "Your CS score suggests vocabulary-in-context and author-choice questions should be a focus area.",
            items: [
              moduleItem(
                "read-cs-context",
                "It's All in the Context",
                "Vocabulary in Context"
              ),
            ],
          },
          {
            min: 6,
            priority: "low",
            reason:
              "Your CS score is already solid, so a compact perfect-scorer review is enough here.",
            items: [
              moduleItem(
                "read-cs-perfect",
                "Who Wants to Be a Perfect Scorer? Reading Edition",
                "Miscellaneous"
              ),
            ],
          },
        ],
      },
      IKI: {
        reasons: {
          low: "Your IKI score suggests you should spend time with synthesis and integration-style reading questions.",
          medium:
            "Your IKI score is workable, and a focused mixed-question review should help stabilize it.",
          high: "Your IKI score is already solid; one advanced mixed-question module is enough here.",
        },
        bands: [
          {
            items: [
              moduleItem(
                "read-iki-perfect",
                "Who Wants to Be a Perfect Scorer? Reading Edition",
                "Miscellaneous"
              ),
            ],
          },
        ],
      },
    },
  },
  science: {
    order: ["IOD", "SIN", "EMI"],
    strategy: [
      moduleItem("sci-strategy-intro", "Introduction to ACT Science"),
      moduleItem(
        "sci-strategy-data",
        "Don't Sweat the Data Stuff",
        "Experimental Design"
      ),
      moduleItem(
        "sci-strategy-digging",
        "Digging into the Questions",
        "Strategies"
      ),
      moduleItem(
        "sci-strategy-conflicting",
        "Conflicting Guests",
        "Conflicting Viewpoints"
      ),
      moduleItem(
        "sci-strategy-perfect",
        "Who Wants to Be a Perfect Scorer? Science Edition",
        "Miscellaneous"
      ),
    ],
    categories: {
      IOD: {
        bands: [
          {
            max: 9,
            priority: "high",
            reason:
              "Your IOD score suggests data-reading and experiment interpretation fundamentals should come first.",
            items: [
              moduleItem(
                "sci-iod-data",
                "Don't Sweat the Data Stuff",
                "Experimental Design"
              ),
            ],
          },
          {
            min: 10,
            priority: "low",
            reason:
              "Your IOD score is already solid, so we’re shifting to higher-level question navigation strategy.",
            items: [
              moduleItem(
                "sci-iod-strategy",
                "Digging into the Questions",
                "Strategies"
              ),
            ],
          },
        ],
      },
      SIN: {
        bands: [
          {
            max: 5,
            priority: "high",
            reason:
              "Your SIN score suggests experimental design and setup questions should be a focus area.",
            items: [
              moduleItem(
                "sci-sin-data",
                "Don't Sweat the Data Stuff",
                "Experimental Design"
              ),
            ],
          },
          {
            min: 6,
            priority: "low",
            reason:
              "Your SIN score is already solid, so we’re keeping the recommendation list short and strategy-focused.",
            items: [
              moduleItem(
                "sci-sin-strategy",
                "Digging into the Questions",
                "Strategies"
              ),
            ],
          },
        ],
      },
      EMI: {
        reasons: {
          low: "Your EMI score suggests you should sharpen conflicting viewpoints and inference evaluation work.",
          medium:
            "Your EMI score is workable, and conflicting viewpoints practice should help make it steadier.",
          high: "Your EMI score is already solid; focus on higher-level conflicting viewpoints practice.",
        },
        bands: [
          {
            items: [
              moduleItem(
                "sci-emi-conflicting",
                "Conflicting Guests",
                "Conflicting Viewpoints"
              ),
            ],
          },
        ],
      },
    },
  },
};
