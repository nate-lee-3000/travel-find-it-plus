# Build a Standalone HTML5 Road Trip Spotting Game

## Project Overview

Build a complete, polished, standalone HTML5 application for a two-player road trip spotting game.

The game is based on a simple concept: two players are given three pairs of similar things to look for while traveling in a vehicle. Each player chooses one item from each pair. Both players then try to spot all three of their selected items while traveling.

The first player to spot their selected item in all three categories wins the round.

**Important:** All three pairs must remain visible and active simultaneously. Players can find their items in any order. This is NOT a turn-based game, and players should not have to complete one category before moving to another.

The application must work independently, without requiring an external database, server, API, account, or internet connection.

## 1. Technical Requirements

Build this as a standalone HTML5 application.

Requirements:
- Use HTML5, CSS3, and vanilla JavaScript.
- No backend or server-side dependencies.
- No external database.
- No external APIs.
- No required internet connection.
- No JavaScript frameworks or build tools required.
- All game data must be stored locally.
- The application should be launchable by opening `index.html` in a modern browser.
- Make the application usable on desktop, tablet, and mobile devices.
- Use localStorage for persistent settings, game history, and preferences.
- Include the complete game data in a local JSON file or embed it in the application.
- Do not use external fonts, scripts, stylesheets, or image dependencies.

Deliver a complete working application, not just a design or code outline.

## 2. Game Rules

The game has:
- Two players.
- Three categories/pairs per round.
- Each pair contains two comparable things.
- Each player selects one item from each pair.
- Each player is independently searching for their three selected items.
- All three searches are active simultaneously.
- Players can find their targets in any order.
- The first player to find two out of three of their selected items wins.
- Players should be able to continue playing their board after a winner has been determined to account for cases where players may want to continue looking for their items (i.e. flexibility for completionist or younger players)

### Example round

| Category | Player 1 | Player 2 |
|---|---|---|
| Farm animals | Cow | Horse |
| Tall structures | Water tower | Windmill |
| Fast food | Taco Bell | McDonald's |

Both players search for all three of their selected targets throughout the drive.

### Player selection

For each pair:
- Display both items clearly.
- Allow each player to select one item.
- The players must select opposite items.
- The first player can choose either item.
- The second player automatically receives the remaining item.
- Allow players to change their selections before starting the round.

The app should make it immediately obvious which player is looking for which item.

## 3. Gameplay Screen

This is the most important screen in the application.

Display all three active categories simultaneously in a clean, easy-to-read layout.

Each category should have:
- Category name.
- Player 1's assigned item.
- Player 2's assigned item.
- A completion control for each player.
- A clear indication of which player has found their item.

When a player spots their assigned item, they can tap a button or checkbox to mark it found.

For example:

CATEGORY: FARM ANIMALS

Player 1: COW
[MARK FOUND]

Player 2: HORSE
[MARK FOUND]

Repeat for all three categories.

### Completion behavior

- Each player independently tracks progress.
- Marking one player's item found must not affect the other player's progress.
- Completed items should be visually distinct.
- Completion should be reversible in case of an accidental tap.
- Show each player's progress, such as 1 of 3, 2 of 3, or 3 of 3.
- All three categories must remain visible throughout gameplay.
- Do not require a specific order of completion.

### Winning behavior

When a player completes all two of three targets:
- Declare that player the winner.
- Display a clear winning message.
- Show the final score/progress.
- Provide options to start another round, return to the main menu, or continue playing the current set.
- If players choose to continue playing after a winner is declared, provide a means to start another round

If both players complete their third target simultaneously, declare a tie.

## 4. Game Setup

Create a setup screen where players can configure a new round.

Include:

**Player names**
- Editable names for both players.
- Default names: Player 1 and Player 2.

**Geographic region**
Allow selection of:
- Michigan
- Midwest
- Great Lakes
- Northeast
- South
- East Coast
- Universal / Any Region

Allow multiple regions to be selected.

**Driving environment**
Allow selection of:
- Rural
- Suburban
- Urban
- Highway
- Waterfront
- Small Town

Allow multiple environments to be selected.

**Season**
- Spring
- Summer
- Fall
- Winter
- Year-round / Any Season

**Difficulty**
- Easy
- Medium
- Hard
- Any Difficulty

Allow users to choose their preferred difficulty or allow the application to select an appropriate mix.

**Start Game** button.

## 5. Pair Selection and Randomization

The application should automatically generate three pairs for each new round.

Requirements:
- Select three distinct broad categories.
- Avoid repeating pairs from recent rounds when possible.
- Respect the selected geographic regions.
- Respect the selected driving environments.
- Respect seasonality.
- Respect the selected difficulty.
- Prefer pairs with similar likelihood.
- Avoid generating obviously mismatched pairs.
- Do not select the same pair twice in one round.

The three pairs should be generated before the selection screen.

Allow users to regenerate the three pairs if they don't like the selection.

Do not change pairs after players have made their selections and started the round.

### Fairness

Fairness is especially important.

A pair should consist of two things that are reasonably similar in:
- How frequently they appear.
- The types of places where they appear.
- Their geographic relevance.
- Their seasonal availability.

For example:
- Cow vs. horse is good.
- Water tower vs. windmill is good.
- Taco Bell vs. McDonald's is good.
- Cow vs. lawyer billboard is not good.

Use the likelihood metadata to avoid overly unbalanced matchups.

## 6. Game Data and JSON Structure

Use the supplied `road_trip_spotting_game.json` as the initial game database.

It contains:
- 100 game pairs.
- Individual reusable items.
- Broad categories and subcategories.
- Geographic regions.
- Driving environments.
- Likelihood ratings.
- Seasonality.
- Difficulty.

The data should remain normalized, using item IDs and category IDs rather than duplicating descriptions.

Preserve the existing data and metadata.

The application should be designed so that additional pairs can easily be added to the JSON file without changing the application logic.

Create a simple data validation function that checks:
- Every pair references two valid items.
- Every pair references a valid category.
- Every pair has valid likelihood, seasonality, and difficulty values.
- No pair contains the same item twice.

## 7. Local Storage and Persistence

Use browser localStorage to save:

- Player names.
- Previous game results.
- Recent pairs played.
- User preferences.
- Total wins for each player.
- Total games played.

The game should survive a browser refresh if a round is in progress.

On reopening the application, allow the user to resume an unfinished game or start a new one.

Provide an option to reset game statistics and history.

Do not require an account or cloud synchronization.

## 8. Statistics and History

Create a basic statistics screen.

Display:
- Total games played.
- Player 1 wins.
- Player 2 wins.
- Ties.
- Recent game history.
- Most frequently played pairs.

Keep this simple and easy to understand.

## 9. Design and User Experience

The application is intended to be used by families in a moving vehicle, so usability is more important than elaborate design.

Design goals:
- Clean, modern, friendly appearance.
- Large buttons and touch targets.
- High contrast.
- Readable typography.
- Minimal navigation.
- Avoid unnecessary animations.
- Avoid clutter.
- Use color to distinguish the two players.
- Clearly show completed versus incomplete items.
- Make the gameplay screen the primary focus.

The application should work especially well on a phone in landscape or portrait orientation.

Avoid small text and controls that require precise tapping.

Do not require players to interact with the app constantly. The game should be easy to check and update when someone spots an item.

## 10. Application Navigation

Include these screens:

1. Home / Main Menu
2. New Game Setup
3. Pair Selection
4. Active Gameplay
5. Round Results
6. Statistics / Game History
7. Settings

The navigation should be straightforward.

## 11. Additional Features

Include the following useful features:

- New Round button.
- Regenerate Pairs button before a round begins.
- Undo accidental completion.
- Resume unfinished game.
- Game history.
- Reset statistics.
- Toggle sound effects on/off (sound should be off by default).
- Option to exclude recently played pairs.
- Option to manually mark a round as abandoned.

Do not add features that complicate the core gameplay.

## 12. Deliverables

Create the following files:

- `index.html`
- `styles.css`
- `app.js`
- `road_trip_spotting_game.json`
- `README.md`

The README should explain:
- How to launch the application.
- How the JSON database is structured.
- How to add new pairs.
- How to modify categories and geographic tags.
- How localStorage works.
- How to reset game data.

## 13. Testing and Quality Assurance

Before considering the application complete, verify:

- It launches without an internet connection.
- Both players can select opposite items.
- All three pairs appear simultaneously during gameplay.
- Both players can complete targets in any order.
- One player's progress does not affect the other.
- A player wins when all three of their targets are found.
- Ties are handled correctly.
- Accidental completion can be reversed.
- New rounds generate different pairs when possible.
- Geographic, environmental, seasonal, and difficulty filters work.
- Game state survives a page refresh.
- Statistics update correctly.
- The application works on mobile and desktop.

Do not leave placeholder functionality or unfinished buttons.

**Final instruction:** Prioritize a fully functional, reliable, standalone game. The core experience is two people simultaneously searching for three independently selected targets during a road trip. Keep that experience simple, intuitive, and fun.