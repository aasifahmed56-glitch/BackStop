# Backstop, explained simply

*A plain-language guide for anyone who wants to understand Backstop. No coding knowledge needed.*

---

## 1. BackStop in one sentence

When an important person leaves a software team, **BackStop reads everything the team left behind and turns it into a checked, honest handover notebook for the person taking over**, so nothing important is lost or guessed.

---

## 2. The problem it solves

Imagine a small restaurant where one head chef has run the kitchen for five years. One day the chef leaves.

- The recipe book is old and half the recipes are missing.
- Many tricks lived only in the chef's head ("never use the left oven for bread, it burns").
- The new chef wastes weeks guessing, and repeats mistakes the old chef already learned from.
- When people try to help by forwarding old messages, private things get shared by accident (salaries, passwords, phone numbers).

Software teams have exactly this problem. The organisers of the hackathon call it the **"information cliff"**: the day someone leaves, the team falls off a cliff of lost knowledge.

---

## 3. What BackStop does about it

BackStop takes the team's everyday "paper trail":

| What it reads | Restaurant comparison |
|---|---|
| The history of every code change (who changed what, when) | The kitchen's daily log |
| Bug reports and discussions | Customer complaints and how they were handled |
| Meeting notes | Staff meeting notes |
| Task lists | The to-do board |
| Team chat messages | The staff group chat |

From all of that it builds a list of short facts called **claims**, such as:

- "Only the leaving person has ever worked on the payments part."
- "The team chose system X over Y because of reason Z."
- "Nobody has touched the deploy scripts for 3 months."

Then a senior person **checks every claim**, and only the approved ones go into the final **handover notebook** for the newcomer.

---

## 4. The five safety rules that make BackStop special

Many tools just ask an AI to "summarise everything". AI can make things up. BackStop is built so it can't get away with that.

1. **Numbers come from plain counting, never from AI.** "Who owns this part" and "how risky is it" are worked out by simple counting of the history, like a cashier counting money. No guessing.
2. **Every AI fact must show its exact proof.** If the AI says "the team chose X", it must copy the *exact sentence* from the notes that says so. BackStop then checks that sentence really exists, word for word. If it doesn't, the fact is thrown out.
3. **Private things are hidden before the AI sees anything.** Passwords, keys, emails and phone numbers are blacked out first.
4. **People only see what they're allowed to see.** A junior newcomer sees a locked box saying "you need higher access" instead of confidential text like budgets.
5. **A human approves before handover.** Nothing reaches the newcomer until a lead has said "yes, this is right", "here is the corrected version", or "no, and here's why". Every change is recorded.

**The motto shown in the app:** *"Every claim shows its source quote and a status. A human approves before handover."*

---

## 5. What a visitor does in the app (the journey)

The live website has simple steps across the top:

1. **Load the sample project.** One click loads a made-up student team's history (220 code changes, 40 bug reports, 10 meeting notes, 60 tasks, 120 chat messages). All people and data in it are fictional.
2. **See the risk list.** BackStop shows which parts of the project are most at risk now that the person is leaving.
3. **Review the claims.** A lead looks at each claim with its proof highlighted and clicks Approve, Edit or Reject.
4. **Open the handover notebook.** Sign in as a new developer or a new project manager, then as a lead, and see that each one sees only what they should. It includes a simple "Day 1 / Week 1 / Month 1" plan. The newcomer can click "Acknowledge" to sign that they received it, and print it.
5. **"Did it work?"** Pages that test BackStop itself: the **Backtest**, the **Trust report**, and **Check a change** (all explained below).

**About sign-in:** team members sign in at `/login`, and administrators sign in at `/admin/login`. Each page refuses the other kind of account. A new developer or a new project manager sees only the screens for their role. Lead-only screens are hidden from them, and the server refuses those requests too. A lead can preview the newcomer handovers. Administrators manage accounts on the Accounts page.

**The repository map.** On the Records page, the project's git history is drawn as a tree of folders and files, and the tree animates as it opens. Each folder shows how many changes it has had and who made them. Folders with risky knowledge are flagged, and so are folders that a tripwire or a claim points to. You only see the tripwires and claims your role may see. A timeline of commits lets you replay how the project changed over time.

---

## 6. Did it work? The honest results

- **Leaks.** An automatic tester attacked every page as every role, about 1,300 times. The first run found 126 real leaks. All were fixed, and the latest run of 1,357 attacks found none.
- **Proof checks.** A simple rule now requires every number, date and name in a fact to appear in its proof. It caught all 5 invented details in a hand-made test set and wrongly rejected no correct facts.
- **Real project.** On the public history of mocha, Backstop's risk list did worse than simply counting the leaver's changes. We show that in the app instead of hiding it.
- **Tripwires.** On mocha, they warned about 89% of changes that later needed fixing, but they also warned on three out of four changes, so they are too noisy to block anyone.

---

## 7. Small word list

| Word | Plain meaning |
|---|---|
| **Claim** | One short fact BackStop found, with its proof |
| **Derived claim** | A fact worked out by counting (no AI) |
| **Interpreted claim** | A fact the AI pulled out, which must quote its proof exactly |
| **Verified / Inferred / Conflicting / Missing** | Proof fully supports it / partly supports it / two sources disagree / no proof found, so it becomes a question for the leaver |
| **Handover notebook (dossier)** | The final checked notebook for the newcomer |
| **Role** | The kind of account you sign in with: new developer, new project manager, lead, or admin. It decides which screens you see |
| **Leaver** | The person leaving the team |
| **Module** | One part or folder of the project |
| **Backtest** | Going back in time to check if BackStop's predictions came true |
| **Baseline** | A very simple method to compare against, to see if BackStop is actually better |
| **Precision / Recall** | Of the warnings given, how many were right / of the real problems, how many were warned about |
| **Tripwire** | A warning before you change something with a risky history |
| **Leak** | Showing someone text they shouldn't be allowed to see |
| **Repository (repo)** | The project's code folder on GitHub |
| **Branch / merge** | A separate working copy / combining copies back into one |
| **Deploy / live link** | Putting the app on the internet / the web address judges open |
| **AI key** | A paid password for using an AI service; the live site works without one by using saved answers |
