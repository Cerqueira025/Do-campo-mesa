export default {
  extends: ["stylelint-config-recommended"],
  overrides: [
    {
      files: [
        "frontend/src/**/*.scss",
        "backoffice/resources/css/**/*.scss",
      ],
      extends: ["stylelint-config-recommended-scss"],
    },
    {
      files: ["backoffice/resources/css/**/*.css"],
      rules: {
        "at-rule-no-unknown": [
          true,
          {
            ignoreAtRules: ["source", "theme"],
          },
        ],
      },
    },
  ],
};
