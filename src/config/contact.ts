/** What a message to the Mabeet team is about, picked on the Contact page so it reaches the team already sorted. */
export const CONTACT_TOPICS = ["booking", "hosting", "privacy", "other"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];
