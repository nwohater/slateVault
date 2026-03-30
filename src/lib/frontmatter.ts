import matter from "gray-matter";
import type { FrontMatter } from "@/types";

export function parseFrontMatter(raw: string): {
  data: FrontMatter;
  content: string;
} {
  const { data, content } = matter(raw);
  return { data: data as FrontMatter, content };
}

export function stripFrontMatter(raw: string): string {
  const { content } = matter(raw);
  return content;
}
