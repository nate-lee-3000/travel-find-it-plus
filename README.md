# Road Trip Spotter

A standalone two-player road-trip spotting game. Each round has three pairs of similar things, such as Cow vs Horse. Player 1 picks one item from each pair, and Player 2 gets the other one. Both players search for all three of their items at the same time, in any order. The first player to spot all three wins.

It uses only HTML, CSS and vanilla JavaScript. There is no server, account or internet connection, and nothing to install.

## Launching

- **Easiest:** double-click `index.html`, or open it in any modern browser (Chrome, Edge, Firefox or Safari, on desktop or mobile).
- **Optional local server:** to have the app read `road_trip_spotting_game.json` directly while you edit it, serve the folder over HTTP. Any static server works, for example `python -m http.server`, then open `http://localhost:8000`.

When opened from disk (`file://`), browsers block JavaScript from reading local files. `index.html` therefore contains an embedded copy of the JSON in `<script id="embedded-game-data">`. The app tries the JSON file first and falls back to the embedded copy.

**After editing the JSON, refresh the embedded copy:**

```powershell
powershell -ExecutionPolicy Bypass -File tools\embed-data.ps1
```

## Files

| File | Purpose |
|---|---|
| `index.html` | App shell plus the embedded data fallback |
| `styles.css` | Layout and theme (light/dark, phone portrait/landscape, tablet, desktop) |
| `app.js` | Game logic, pair generation, validation, storage, rendering |
| `road_trip_spotting_game.json` | The game database (source of truth) |
| `tools/embed-data.ps1` | Copies the JSON into `index.html` |

## JSON database structure

The data is normalized. Pairs reference items, categories and tags by ID.

```jsonc
{
  "schema_version": "1.0.0",
  "game_rules": { ... },                 // informational
  "collections": {
    "items":          [{ "id": "cow", "name": "Cow" }],
    "categories":     [{ "id": "agriculture", "label": "Agriculture & Farm Life" }],
    "subcategories":  [{ "id": "farm_animals", "label": "Farm Animals" }],
    "regions":        [{ "id": "michigan", "label": "Michigan" }],
    "environments":   [{ "id": "rural", "label": "Rural" }],
    "attribute_options": {
      "likelihood":  ["very_common", "common", "moderate", "uncommon", "rare"],
      "seasonality": ["year_round", "spring", "summer", "fall", "winter"],
      "difficulty":  ["easy", "medium", "hard"]
    },
    "pairs": [{
      "id": "pair_001",
      "item_ids": ["cow", "horse"],
      "category_id": "agriculture",
      "subcategory_id": "farm_animals",
      "region_ids": ["michigan", "midwest"],
      "environment_ids": ["rural"],
      "likelihood": "common",
      "seasonality": ["year_round"],
      "difficulty": "easy",
      "active": true
    }]
  }
}
```

### How pairs are chosen

- **Region:** a pair matches if it shares any selected region. Pairs tagged `universal` always match. If no region is selected, any region matches.
- **Environment:** a pair matches if it shares any selected environment. If none is selected, any environment matches.
- **Season:** a pair matches if it lists the chosen season or `year_round`. "Any Season" disables this filter.
- **Difficulty:** an exact match, or "Any" for a mix.
- Every round uses three different broad categories (`category_id`).
- The three pairs are chosen to have similar `likelihood`. Pairs played recently are avoided: they are excluded when that setting is on, and otherwise de-prioritized.
- If the filters leave fewer than three categories, filters are relaxed in this order: recent-pair exclusion, difficulty, environment, season, then region. The selection screen says which filters were relaxed.

**Fairness:** `likelihood` is stored per pair, so both items in a pair are meant to be equally common. Keep that in mind when adding pairs.

## Adding new pairs

1. Add any new items to `collections.items` with a unique `id` and a display `name`.
2. Add a pair to `collections.pairs` with a unique `id`, two different `item_ids`, an existing `category_id`, and values from `attribute_options`.
3. Run `tools\embed-data.ps1`, or serve the folder over HTTP.

No code changes are needed. To hide a pair without deleting it, set `"active": false`.

## Changing categories and geographic tags

- **New category or subcategory:** add `{ "id", "label" }` to `categories` or `subcategories`, then reference its ID from pairs.
- **New region or environment:** add it to `regions` or `environments`. It appears automatically as a choice on the setup screen. Then tag pairs with it in `region_ids` or `environment_ids`.
- **Renaming a label:** change only `label`. Keep the `id` so existing pairs and saved history still work.

### Validation

On load, `validateData()` checks that every pair:

- references two valid, different items,
- references a valid category,
- has valid likelihood, seasonality and difficulty values.

Unknown subcategory, region or environment IDs are reported as warnings. Invalid pairs are skipped, not played. See **Settings → Game data** for the counts and details.

## localStorage

Everything is saved in one key, `roadTripSpotter.v1`, in the browser you play in:

- `settings`: player names, filter choices, sound (off by default), the exclude-recent option and its window (3, 5 or 10 rounds)
- `stats`: games played, Player 1 wins, Player 2 wins, ties, abandoned rounds
- `history`: up to 200 past rounds (pairs, picks, what was found, result)
- `recentPairs`: recently played pair IDs, used to avoid repeats
- `current`: the unfinished round, so it survives a refresh or closed tab

When you reopen the app, it offers to resume any unfinished round. Data stays on that device and in that browser. Private or incognito windows discard it when closed.

## Resetting game data

- **Settings → Reset statistics & history** (also on the Statistics screen) clears totals, history and recent pairs. Names and settings are kept.
- **Settings → Reset everything** clears all saved data, including any unfinished game.
- **Manual reset:** in browser dev tools, run `localStorage.removeItem('roadTripSpotter.v1')`.

## Gameplay notes

- All three pairs stay on screen for the whole round. Each player's "Mark found" buttons affect only that player.
- Tapping a found item again un-marks it.
- When a player reaches 3 of 3, a confirmation appears with three choices: confirm the win, call a tie (if both finished together), or undo the last tap. If one tap completes both players, it is a tie.
- "Abandon round" records the round as abandoned. It doesn't count as a game played, a win or a loss.
