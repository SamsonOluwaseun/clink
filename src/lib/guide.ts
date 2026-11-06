/*
 * The quick guide, written as Oluwaseun walking a new parent through Clink.
 * Used by the in-app guide screen. docs/USER_GUIDE.md has the same words.
 */

export type GuideArt = 'welcome' | 'child' | 'goal' | 'reward' | 'celebrate' | 'give' | 'report' | 'family';

export interface GuideStep {
  art: GuideArt;
  title: string;
  body: string[];
  tip?: string;
}

export const guideSteps: GuideStep[] = [
  {
    art: 'welcome',
    title: 'Welcome to Clink',
    body: [
      'Hi, I’m Oluwaseun. I built Clink to help my children learn that good habits add up to something they want.',
      'Let me walk you through it. It takes about two minutes.',
    ],
    tip: 'No real money moves through Clink. It keeps track, and you buy the treat when the jar is full.',
  },
  {
    art: 'child',
    title: 'Add your child',
    body: [
      'Tap “+ Add child” on the home screen. Type their name, and tap the circle to add their photo.',
      'If you give weekly pocket money, add it here too. Clink puts it in their jar on the day you choose.',
    ],
    tip: 'Each child is listed on the home screen, so you will always see who is already added.',
  },
  {
    art: 'goal',
    title: 'Let them choose a goal',
    body: [
      'Next, set what they are saving for, like a toy car, and how much it costs. Add a photo of the real thing so they can see it on their jar.',
      'Let your child choose it. They work harder for something they picked.',
    ],
    tip: 'They earn a star at every quarter of the way. You can add more goals for later.',
  },
  {
    art: 'reward',
    title: 'Give a reward',
    body: [
      'Tap “Give a reward”. Choose the day, home or school, what they did, and how much.',
      'Then pick some praise, like “You kept going, even when it was hard”. Praising how they tried works better than calling them clever.',
    ],
    tip: 'Their favourite rewards appear as one-tap buttons on their card. “Praise only” gives a reward without money.',
  },
  {
    art: 'celebrate',
    title: 'Celebrate together',
    body: [
      'Hand them the phone. Coins drop into the jar, there is applause, and Clink says “Well done!” with their name and what they did.',
      'In Settings, record your own voice, so they hear you cheering them on every time.',
    ],
    tip: '“Show me” on their card opens a big, simple view of their jar just for them.',
  },
  {
    art: 'give',
    title: 'Teach them to give',
    body: [
      'Tap “Tithe or offering” on their card. Clink explains both in simple words and works out a tithe as a tenth of what they earned that week.',
      'The gift comes out of their savings and waits on your “Gifts to pay” list until you have paid it in.',
    ],
  },
  {
    art: 'report',
    title: 'See their week',
    body: [
      'Tap “Report” to see what each child earned day by day, at home and at school. You can share it with the family.',
      'Turn on reminders for a Sunday summary and a gentle nudge when a child has not been rewarded for a few days.',
    ],
  },
  {
    art: 'family',
    title: 'Use it as a family',
    body: [
      'Both parents can use Clink. In Settings, open Family sync. Show the pairing code on one phone and scan it with the other.',
      'Rewards then share between your phones on your home Wi-Fi, with no account. Save a backup now and then, so nothing is ever lost.',
    ],
    tip: 'That’s it. Start by adding your first child.',
  },
];
