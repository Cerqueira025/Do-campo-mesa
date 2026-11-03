export default {
  extends: ["stylelint-config-recommended"],
  overrides: [
    {
      files: [
        "frontend/src/**/*.scss",
        "backoffice/app/resources/css/**/*.scss",
      ],
      extends: ["stylelint-config-recommended-scss"],
    },
    {
      files: ["backoffice/app/resources/css/**/*.css"],
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
