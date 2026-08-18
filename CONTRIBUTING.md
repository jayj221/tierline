# Contributing

## Updating prices

This is the most useful thing anyone can do here, and it needs doing often.

Prices live in [`src/models.js`](src/models.js). Each entry is USD, either per million tokens for text models or per character, second, image, minute or track where the vendor bills that way.

To update one:

1. Open the vendor's public pricing page. Not a blog post, not an aggregator, the pricing page.
2. Change `in` and `out` on that entry.
3. Bump `PRICES_CHECKED` at the top of the file to the current month.
4. Run `npm test`. The catalogue assertions will catch a malformed entry.
5. Open a PR with the pricing URL in the description so it can be checked.

Please do not add negotiated or enterprise rates. Those are specific to one buyer and would make the defaults misleading for everyone else.

## Adding a model

Same file. An entry needs `id`, `tool`, `slug`, `provider`, `label`, `tier`, `modes`, a price, and a one line `note` describing when someone would reach for it.

Pick the tier honestly:

| Tier | Meaning |
| :--- | :--- |
| 0 | Bulk classification, tagging, dedupe. Cheap and shallow |
| 1 | Fast general work, summaries, simple drafting |
| 2 | The default workhorse. Most real tasks |
| 3 | Deep reasoning, hard debugging, high stakes |

Tier inflation is the main way this tool could become useless, so if you are unsure, go lower. A model that gets picked and underperforms is a worse outcome than one that never gets picked.

## Changing the classifier

Rules live in [`src/classify.js`](src/classify.js) as plain regexes. Add a test in `test/run.js` alongside any change, and watch out for greedy matching: an earlier bug had `class` swallow `classify` and read every classification prompt as engineering work.

The classifier stays rules based on purpose. It has to be arguable by someone reading it, because the output is a budget decision.

## Running things

```bash
npm test                                  # 24 assertions
node bin/tierline.js "your prompt" -n 5000
node server.js                            # web UI on :4180
node mcp/server.js                        # MCP over stdio
```

No dependencies. Keep it that way.
