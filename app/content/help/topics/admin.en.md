# For administrators

Under **Admin** you set what teachers can use on this installation. Only administrators see this topic. [Two-step verification](/help/account) is required for administrators.

In the menu, Admin opens as a list in four groups: **People**, **Organisation**, **AI** and **Oversight**. The same groups are on the left of every admin page.

## Overview and setup

This is where you start. At the top are six steps to set up the institution, from top to bottom: choose the word for the layer under the institution (for example faculty), create the faculties, invite colleagues, create teams and add colleagues, create the programmes, and put every programme under a faculty. Each step shows whether it is done, with a link to the place where you do it. The faculty steps are optional. Below that are all admin pages, each with what it is for.

## Users

Search for someone and open their page. There you change the role, set an account to inactive, or switch two-step verification off when someone has lost both phone and recovery codes.

You invite new colleagues with an **invite link**. If you paste a list of names and email addresses (for example two columns from Excel), everyone gets their own link. LimeOnIt sends no email itself: you pass the links on. An invite never makes an administrator.

## Teams

Create teams of colleagues and appoint team leads. Per team you can switch on features, tools and models that are *On request* for everyone else. See also [Teams and sharing](/help/teams).

## Faculties and programmes

Choose what your institution calls the layer between institution and programme and create those parts, for example with **New faculty**. You delete an empty faculty after a confirmation. Where a programme belongs is chosen in the programme's **Details**; click its name on Organisation to get there. You create a programme under **Programmes**, in the **Education** menu. See also [Programmes](/help/programmes).

## Referral guide

At the bottom of **Organisation** you fill in the referral guide: per kind of question (study delay and rules, mental health, disability, unwanted behaviour, money) the counter, a short description and a link (https:// or mailto:). Leave a kind of question empty if your institution has no counter for it. Teachers see the guide in the help on [study career coaching](/help/slb) and under the result of *Prepare a conversation*. Preferably name a counter or role rather than a person.

## Announcements

Put an announcement as a bar above every page, for everyone, one team or one person. Choose *Announcement* or *Warning* (for example during an outage). Everyone can close the bar for themselves. If you want it to come back, fill in after how many days (1 to 30). With a last day it disappears by itself; without one it stays until you remove it.

## Tools and models

- **Tools:** set each tool to *On*, *On request* or *Off*. *Off* is for nobody; *On request* only through a team or an exception for one teacher.
- **Models:** choose which AI models teachers may pick themselves. A teacher follows that choice, or gets a choice of their own. Here you also choose **the institution's default model**: the tools start on it. A team (on the team page) and a teacher (on their account page, or you on the person page) can choose a default of their own, but only from the models they may use. Expensive models (such as Opus) are not in the institution's choice; you switch them on for one team (on the team page) or one teacher (on the person page). Then they can pick it, also as their default. The monthly limit still applies. A model you added yourself can be **edited** (name, effort, temperature and the switches) and **removed** while it has never been used and nobody has chosen it. Once it has been used, upgrade it to another model instead.
- **Providers:** the AI services the models come from.

What is off really disappears: a teacher can't open such a tool through a link either.

## Review team

Switch the review team on or off, and each member separately. The review team advises teachers on their course; it never changes a course.

## Anonymising

Before anything goes to an AI, the anonymiser gate replaces names and personal data with codes. Teachers put words that are not a name on their **never-list**, for example a researcher who happens to share a colleague's name. On this page you see which words those are and how many teachers chose each, never who. With **Keep for everyone** the gate replaces that word for nobody any more; **Remove** undoes it. A user's full name cannot go on the list.

## Institution teaching context

Choose which sectors (secondary, vocational, higher education, university) and domains teachers can pick in their teaching context.

## AI use and cost

This link opens the **Usage** page. As an admin you see everyone's AI use there: per person, team, tool and model, with the costs in euros. At the bottom you set the **limits per month**, in euros: per team and per teacher (the teacher's own limit wins). From 80% the teacher sees a notice, at 100% the AI stops until next month. Admins have no limit. The owner also sets the whole institution's budget there. Every change goes into the audit log. See [What we measure](/help/usage).

## Feedback and pilot

Here you see what teachers filled in under *Was this helpful?*, and per tool how the pilot is going.

## Audit log

The audit log shows who changed what about roles, passwords, accounts, invites and model choice. Entries disappear automatically after a year. Only the owner can clean up earlier.

## Health

At the top of every admin page is the state of the server: the last backup, the size of the database and the free disk space. If the last backup is older than 36 hours, you see a warning. Below it is how often the anonymiser gate found something in the past week, per kind (colleagues, email addresses, phone numbers …) and next to the week before: counts only, never which words. If one kind suddenly goes off far more often, you see a warning about that too. The owner also sees **Recent errors**.
