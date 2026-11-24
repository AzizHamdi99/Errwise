/** One titled part of a docs or legal page. The id is the anchor, so do not rename it lightly. */
export interface ArticleSection {
  id: string;
  title: string;
  body: React.ReactNode;
}
