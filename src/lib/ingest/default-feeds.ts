export interface FeedSeed {
  name: string;
  url: string;
  siteUrl?: string;
  region: string;
  language?: string;
  category: "international" | "regional" | "investigative" | "official" | "research" | "industry" | "science";
  enabled?: boolean;
}

/**
 * A starting set of publicly offered RSS/Atom feeds. Publishers change feed URLs
 * occasionally; failures are recorded per feed and shown in Settings → Sources,
 * where feeds can be disabled, replaced, or removed.
 *
 * Only headline, link, date and the publisher-provided description are stored.
 * Full article text is never scraped.
 */
export const DEFAULT_FEEDS: FeedSeed[] = [
  // International
  { name: "BBC News — World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", siteUrl: "https://www.bbc.co.uk/news/world", region: "Global", category: "international" },
  { name: "The Guardian — World", url: "https://www.theguardian.com/world/rss", siteUrl: "https://www.theguardian.com/world", region: "Global", category: "international" },
  { name: "Al Jazeera English", url: "https://www.aljazeera.com/xml/rss/all.xml", siteUrl: "https://www.aljazeera.com", region: "Middle East", category: "international" },
  { name: "NPR — World", url: "https://feeds.npr.org/1004/rss.xml", siteUrl: "https://www.npr.org/sections/world/", region: "North America", category: "international" },
  { name: "DW — English", url: "https://rss.dw.com/rdf/rss-en-all", siteUrl: "https://www.dw.com/en", region: "Europe", category: "international" },
  { name: "France 24 — English", url: "https://www.france24.com/en/rss", siteUrl: "https://www.france24.com/en/", region: "Europe", category: "international" },
  { name: "The New York Times — World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", siteUrl: "https://www.nytimes.com/section/world", region: "North America", category: "international" },
  { name: "CNBC — World", url: "https://www.cnbc.com/id/100727362/device/rss/rss.html", siteUrl: "https://www.cnbc.com/world/", region: "Global", category: "industry" },

  // Regional
  { name: "The Daily Star (Bangladesh)", url: "https://www.thedailystar.net/frontpage/rss.xml", siteUrl: "https://www.thedailystar.net", region: "South Asia", category: "regional" },
  { name: "The Hindu — International", url: "https://www.thehindu.com/news/international/feeder/default.rss", siteUrl: "https://www.thehindu.com/news/international/", region: "South Asia", category: "regional" },
  { name: "Dawn (Pakistan)", url: "https://www.dawn.com/feeds/home", siteUrl: "https://www.dawn.com", region: "South Asia", category: "regional" },
  { name: "South China Morning Post — World", url: "https://www.scmp.com/rss/91/feed", siteUrl: "https://www.scmp.com", region: "East Asia", category: "regional" },
  { name: "The Japan Times", url: "https://www.japantimes.co.jp/feed/", siteUrl: "https://www.japantimes.co.jp", region: "East Asia", category: "regional" },
  { name: "ABC News (Australia)", url: "https://www.abc.net.au/news/feed/2942460/rss.xml", siteUrl: "https://www.abc.net.au/news", region: "Oceania", category: "regional" },
  { name: "AllAfrica — Latest", url: "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf", siteUrl: "https://allafrica.com", region: "Africa", category: "regional" },
  { name: "MercoPress", url: "https://en.mercopress.com/rss", siteUrl: "https://en.mercopress.com", region: "Latin America", category: "regional" },

  // Investigative
  { name: "ProPublica", url: "https://www.propublica.org/feeds/propublica/main", siteUrl: "https://www.propublica.org", region: "North America", category: "investigative" },
  { name: "ICIJ", url: "https://www.icij.org/feed/", siteUrl: "https://www.icij.org", region: "Global", category: "investigative" },
  { name: "Bellingcat", url: "https://www.bellingcat.com/feed/", siteUrl: "https://www.bellingcat.com", region: "Global", category: "investigative" },

  // Official / institutional
  { name: "UN News", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", siteUrl: "https://news.un.org", region: "Global", category: "official" },
  { name: "WHO — News", url: "https://www.who.int/rss-feeds/news-english.xml", siteUrl: "https://www.who.int/news", region: "Global", category: "official" },
  { name: "Federal Reserve — Press releases", url: "https://www.federalreserve.gov/feeds/press_all.xml", siteUrl: "https://www.federalreserve.gov", region: "North America", category: "official" },

  // Research & expert commentary
  { name: "The Conversation — Global", url: "https://theconversation.com/global/articles.atom", siteUrl: "https://theconversation.com/global", region: "Global", category: "research" },
  { name: "Brookings", url: "https://www.brookings.edu/feed/", siteUrl: "https://www.brookings.edu", region: "North America", category: "research", enabled: false }, // feed XML is currently malformed

  // Technology, industry, science
  { name: "Rest of World", url: "https://restofworld.org/feed/latest/", siteUrl: "https://restofworld.org", region: "Global", category: "industry" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", siteUrl: "https://arstechnica.com", region: "Global", category: "industry" },
  { name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", siteUrl: "https://www.technologyreview.com", region: "Global", category: "industry" },
  { name: "Nature — News", url: "https://www.nature.com/nature.rss", siteUrl: "https://www.nature.com", region: "Global", category: "science" },
];
