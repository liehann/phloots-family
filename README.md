# phloots-family

Claude plugins for the household.

## meal-plan

A side pane with the week's dinners (Mon to Thu, re-orderable, headcount per day) and the Sprouts shopping list. Each item has Buy / Have / Don't need, and every dinner has a note field plus a general notes box. Changes are sent to Claude about 20 seconds after the last click (or right away with **Send now**), and Claude updates the Instacart cart to match.

It also carries the `weekly-meal-plan` skill: how Claude turns a meal plan into the cart (recipes from the Google Drive "Recipes" folder, asking when a recipe is missing, brand preferences, headcount by day).

Needs the Google Drive and Instacart connectors in Claude.

### Install

At the prompt of a Claude Code or Claude desktop session:

```
/plugin install meal-plan --marketplace liehann/phloots-family
```

Answer `y` to add the marketplace, then pick a scope (user scope makes it available everywhere).

From a shell:

```
claude plugin marketplace add liehann/phloots-family
claude plugin install meal-plan@phloots-family
```

### Use

Give Claude the week's meals in day order plus what you need and don't need. It builds the cart and fills the pane. Open the pane with `/meal-plan`.
