# What we measure

On **Usage**, in the menu at the top right, you see how often the tools call AI for you. Pick a month at the top; you see that month and the eight weeks before it.

## What we count

Per day, per tool and per model we count:

- the number of calls, and how many of them failed or were aborted;
- the tokens: what went to the model, which part of it came from the cache, and what the model wrote back.

Chats count too, even when you stop an answer halfway. For admins we also work out roughly what a call cost, at the price at that moment.

## What we do not count

- **What you write and what the AI answers.** Only counters, never text.
- **The time.** We only keep the day, so no work pattern can be read from it.

## Who sees what

- **You** see your own calls per week, per tool and per model, and how many calls you have left today.
- **A team lead** sees the team's totals, per tool and per model. Never per person, and without costs. When fewer than three team members used AI that month, the lead only sees the total, so nobody can be singled out.
- **Admins** see everyone: per person, team, tool and model, with the costs.
- **The owner** of this installation also sees a forecast for the month and what caching saved.

## Tokens and the cache

A token is a piece of text of a few letters. A provider charges per token. In a chat the whole conversation goes to the model again on every turn. The provider keeps part of it in a cache for a while, and tokens from the cache are a lot cheaper.

## The daily limit

There is a daily limit on the number of calls per person. A new day starts at midnight (UTC). Admins have no daily limit.

## Costs are an estimate

The costs come from our own counts, at each model's price at the time of the call. The real amount is on the provider's invoice. For a model without a known price we say how many calls were left out, rather than show costs that are too low.

## Deleting your data

When you delete your account, these counters go with it.

## How long we keep it

The counters per person stay for 13 months: this month and the twelve before, exactly what you can pick at the top. After that we add them up into month totals per tool and model, for the whole institution and per team, and delete them per person. Those totals no longer hold a name.
