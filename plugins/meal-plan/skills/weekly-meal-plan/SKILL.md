---
name: weekly-meal-plan
description: Plan the week's family dinners and build the Sprouts Instacart order. Use when Liehann gives a week's meal plan or grocery list, asks to build or update the shopping list or cart, or the meal-plan panel sends changes.
---

# Weekly meal plan and Sprouts order

## The household

- Dinners are planned for Mon, Tue, Wed, Thu. The meals are listed in day order: the first is Monday. The panel lets him re-order them, and the order there is the day order.
- Headcount: Mon and Wed are 4 (2 adults, 2 kids). Tue and Thu are usually 6 (friends join: 4 adults, 2 kids). Scale quantities to the day.
- Friday is pod dinner with friends (takeout or out). Weekend meals are planned only when he asks.
- Kids' lunches need fruit, sandwich bread or rolls, deli meat and crunchy snacks. He says which of these he already has.
- He doesn't eat seafood. No onion in the bacon pasta.

## Steps

1. **Read the request.** Split what he says into: items he definitely needs, items he does not need, items he has, and meals. When an item is on both the need and don't-need lists, ask.
2. **Find each recipe** in the Google Drive "Recipes" folder (search by title and full text). Use the recipe's ingredients and scale to the day's headcount.
3. **A recipe not in Drive: ask, never assume.** Ask what goes in it. Once he answers, write it as a Google Doc in the Recipes folder (ingredients with amounts, steps, notes), then add its ingredients.
4. **Build the Instacart cart** at Sprouts Farmers Market (delivery). Leave items already in the cart unless he says otherwise. Check every quick-add result and fix wrong matches with a search:
   - Brands: Sprouts Whole Milk; Oroweat whole wheat bread; Sprouts green leaf lettuce (Tanimura & Antle Sweet Gem as backup); Mission Carb Balance tortillas.
   - Generally non-organic. Bulk sizes when offered (spices). Apples: balance cost against varieties they like; organic Cosmic Crisp is often poor.
   - Burger buns (Artesano) come from Safeway, not this order. Japanese curry pork comes from the Asian grocery: only the veg goes in this order.
   - Past orders can hold wrong substitutions, so don't copy purchase history blindly.
   - Pick a size that fits the recipe (8 oz mushrooms, not 24 oz).
   - Name every substitution and anything not stocked.
5. **Fill the panel.** Call `mcp__meal-plan__set_plan` with the full plan: `week` ("Week of Oct 26"), `meals` in day order (`id`, `name`, `recipe` naming the Drive doc or "Not in Drive yet"), `extras` (always `lunch` and `staples`, plus any other section such as a sauce), and `items` (`id`, `group` = a meal or extra id, `name`, `detail` = product and size, `qty`, `status` = `buy` / `have` / `skip` / `null` for undecided, `flag` for a substitution or open question, `pid` = the Instacart product id). Then tell him to open it with `/meal-plan`.
6. **When the panel sends changes** ("Meal plan panel changes: ..."): call `mcp__meal-plan__get_plan`, then make the Sprouts cart match every item marked `buy`: add missing ones, remove ones now `have` or `skip`, set quantities. Act on the notes (a note may add an item or answer a question). Write new product ids and cleared flags back with `set_plan`. Reply with one or two lines on what changed in the cart.

## Nutrition

He tracks macros (high protein, carbs scaled to training). When asked, give per-serving estimates for dinners and suggest swaps that raise protein or move carbs to ride-eve dinners.
