export interface FeedSeed {
  name: string;
  url: string;
  siteUrl?: string;
  region: string;
  language?: string;
  category: "international" | "regional" | "investigative" | "official" | "research" | "industry" | "science" | "analysis" | "topic" | "culture" | "video" | "reference";
  enabled?: boolean;
  /** Channels this feed belongs to by default (ids). Default: the news channel. */
  channels?: string[];
}

/**
 * A starting set of publicly offered RSS/Atom feeds. Publishers change feed URLs
 * occasionally; failures are recorded per feed and shown in Settings → Sources,
 * where feeds can be disabled, replaced, or removed.
 *
 * Only headline, link, date and the publisher-provided description are stored.
 * Full article text is never scraped.
 */
/** Bump when DEFAULT_FEEDS gains entries, so existing installations receive them once. */
export const FEED_CATALOG_VERSION = 4;

export function googleNewsTopicUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

export function isGoogleNewsFeed(url: string): boolean {
  return /^https:\/\/news\.google\.com\/rss/.test(url);
}

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
  { name: "Dhaka Tribune", url: "https://www.dhakatribune.com/feed/", siteUrl: "https://www.dhakatribune.com", region: "South Asia", category: "regional" },
  { name: "The Business Standard (Bangladesh)", url: "https://www.tbsnews.net/bangladesh/rss.xml", siteUrl: "https://www.tbsnews.net", region: "South Asia", category: "regional" },
  { name: "The Business Standard — Economy", url: "https://www.tbsnews.net/economy/rss.xml", siteUrl: "https://www.tbsnews.net", region: "South Asia", category: "regional" },
  { name: "Scroll.in", url: "https://feeds.feedburner.com/ScrollinArticles.rss", siteUrl: "https://scroll.in", region: "South Asia", category: "regional" },
  { name: "The Kathmandu Post", url: "https://kathmandupost.com/rss", siteUrl: "https://kathmandupost.com", region: "South Asia", category: "regional" },
  { name: "Himal Southasian", url: "https://www.himalmag.com/feed", siteUrl: "https://www.himalmag.com", region: "South Asia", category: "analysis" },
  { name: "Middle East Eye", url: "https://www.middleeasteye.net/rss", siteUrl: "https://www.middleeasteye.net", region: "Middle East", category: "regional" },
  { name: "Arab News", url: "https://www.arabnews.com/rss.xml", siteUrl: "https://www.arabnews.com", region: "Middle East", category: "regional" },
  { name: "Al-Monitor", url: "https://www.al-monitor.com/rss", siteUrl: "https://www.al-monitor.com", region: "Middle East", category: "regional" },
  { name: "+972 Magazine", url: "https://www.972mag.com/feed/", siteUrl: "https://www.972mag.com", region: "Middle East", category: "investigative" },
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

  { name: "The Diplomat", url: "https://thediplomat.com/feed/", siteUrl: "https://thediplomat.com", region: "Asia", category: "analysis" },
  { name: "Foreign Policy", url: "https://foreignpolicy.com/feed/", siteUrl: "https://foreignpolicy.com", region: "Global", category: "analysis" },
  { name: "International Crisis Group", url: "https://www.crisisgroup.org/rss.xml", siteUrl: "https://www.crisisgroup.org", region: "Global", category: "analysis" },
  { name: "The Economist — Asia", url: "https://www.economist.com/asia/rss.xml", siteUrl: "https://www.economist.com/asia", region: "Asia", category: "analysis" },
  { name: "Financial Times — World", url: "https://www.ft.com/world?format=rss", siteUrl: "https://www.ft.com/world", region: "Global", category: "international" },

  // Topic watches (Google News search feeds: headlines from many outlets, including those without their own feeds)
  { name: "Topic: Bangladesh", url: googleNewsTopicUrl("Bangladesh"), siteUrl: "https://news.google.com", region: "South Asia", category: "topic" },

  // Technology, industry, science
  { name: "Rest of World", url: "https://restofworld.org/feed/latest/", siteUrl: "https://restofworld.org", region: "Global", category: "industry" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", siteUrl: "https://arstechnica.com", region: "Global", category: "industry" },
  { name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", siteUrl: "https://www.technologyreview.com", region: "Global", category: "industry" },
  { name: "Nature — News", url: "https://www.nature.com/nature.rss", siteUrl: "https://www.nature.com", region: "Global", category: "science" },
  // Books, film, music & culture (channel: ch_culture)
  { name: "The Guardian — Books", url: "https://www.theguardian.com/books/rss", region: "Global", category: "culture", channels: ["ch_culture"] },
  { name: "The Guardian — Film", url: "https://www.theguardian.com/film/rss", region: "Global", category: "culture", channels: ["ch_culture"] },
  { name: "The Guardian — Culture", url: "https://www.theguardian.com/culture/rss", region: "Global", category: "culture", channels: ["ch_culture"] },
  { name: "Variety", url: "https://variety.com/feed/", region: "Global", category: "culture", channels: ["ch_culture"] },
  { name: "The Hollywood Reporter", url: "https://www.hollywoodreporter.com/feed/", region: "Global", category: "culture", channels: ["ch_culture"] },
  { name: "IndieWire", url: "https://www.indiewire.com/feed/", region: "Global", category: "culture", channels: ["ch_culture"] },
  { name: "Literary Hub", url: "https://lithub.com/feed/", region: "Global", category: "culture", channels: ["ch_culture"] },
  { name: "The New York Times — Books", url: "https://rss.nytimes.com/services/xml/rss/nyt/Books.xml", region: "North America", category: "culture", channels: ["ch_culture"] },
  { name: "The New York Times — Movies", url: "https://rss.nytimes.com/services/xml/rss/nyt/Movies.xml", region: "North America", category: "culture", channels: ["ch_culture"] },
  { name: "BBC — Entertainment & Arts", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", region: "Global", category: "culture", channels: ["ch_culture"] },
  { name: "Pitchfork — News", url: "https://pitchfork.com/feed/feed-news/rss", region: "Global", category: "culture", channels: ["ch_culture"] },
  { name: "Rolling Stone", url: "https://www.rollingstone.com/feed/", region: "Global", category: "culture", channels: ["ch_culture"] },
  { name: "The Hindu — Entertainment", url: "https://www.thehindu.com/entertainment/feeder/default.rss", region: "South Asia", category: "culture", channels: ["ch_culture"] },
  { name: "Publishers Weekly", url: "https://www.publishersweekly.com/pw/feeds/recent/index.xml", region: "Global", category: "culture", channels: ["ch_culture"] },
  { name: "Topic: Bangladeshi film & books", url: googleNewsTopicUrl('Bangladesh (film OR cinema OR novel OR author OR book)'), siteUrl: "https://news.google.com", region: "South Asia", category: "topic", channels: ["ch_culture"] },

  // News channels on YouTube (videos as sources: titles, descriptions, thumbnails)
  { name: "Jamuna TV (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCN6sm8iHiPd0cnoUardDAnw", siteUrl: "https://www.youtube.com/channel/UCN6sm8iHiPd0cnoUardDAnw", region: "South Asia", category: "video" },
  { name: "Somoy TV (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCxHoBXkY88Tb8z1Ssj6CWsQ", siteUrl: "https://www.youtube.com/channel/UCxHoBXkY88Tb8z1Ssj6CWsQ", region: "South Asia", category: "video" },
  { name: "Channel 24 (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCHLqIOMPk20w-6cFgkA90jw", siteUrl: "https://www.youtube.com/channel/UCHLqIOMPk20w-6cFgkA90jw", region: "South Asia", category: "video" },
  { name: "Ekattor TV (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCtqvtAVmad5zywaziN6CbfA", siteUrl: "https://www.youtube.com/channel/UCtqvtAVmad5zywaziN6CbfA", region: "South Asia", category: "video" },
  { name: "Independent Television (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCATUkaOHwO9EP_W87zCiPbA", siteUrl: "https://www.youtube.com/channel/UCATUkaOHwO9EP_W87zCiPbA", region: "South Asia", category: "video" },
  { name: "Channel i (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCAz6rveBalVnE6qTmfQnvyQ", siteUrl: "https://www.youtube.com/channel/UCAz6rveBalVnE6qTmfQnvyQ", region: "South Asia", category: "video" },
  { name: "RTV News (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC2P5Fd5g41Gtdqf0Uzh8Qaw", siteUrl: "https://www.youtube.com/channel/UC2P5Fd5g41Gtdqf0Uzh8Qaw", region: "South Asia", category: "video" },
  { name: "The Business Standard (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCUNEzmQ3zcifrhn0HwCgjYg", siteUrl: "https://www.youtube.com/channel/UCUNEzmQ3zcifrhn0HwCgjYg", region: "South Asia", category: "video" },
  { name: "Dhaka Tribune (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCB58cDLM3zZlgV6iIG9bdoQ", siteUrl: "https://www.youtube.com/channel/UCB58cDLM3zZlgV6iIG9bdoQ", region: "South Asia", category: "video" },
  { name: "DW News (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCknLrEdhRCp1aegoMqRaCZg", siteUrl: "https://www.youtube.com/channel/UCknLrEdhRCp1aegoMqRaCZg", region: "Global", category: "video" },
  { name: "Al Jazeera English (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCNye-wNBqNL5ZzHSJj3l8Bg", siteUrl: "https://www.youtube.com/channel/UCNye-wNBqNL5ZzHSJj3l8Bg", region: "Middle East", category: "video" },
  { name: "The Economist (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC0p5jTq6Xx_DosDFxVXnWaQ", siteUrl: "https://www.youtube.com/channel/UC0p5jTq6Xx_DosDFxVXnWaQ", region: "Global", category: "video" },
  { name: "BBC News (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC16niRr50-MSBwiO3YDb3RA", siteUrl: "https://www.youtube.com/channel/UC16niRr50-MSBwiO3YDb3RA", region: "Global", category: "video" },
  { name: "WION (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC_gUM8rL-Lrg6O3adPW9K1g", siteUrl: "https://www.youtube.com/channel/UC_gUM8rL-Lrg6O3adPW9K1g", region: "South Asia", category: "video" },

  // Reference creators: what top explainer channels publish (kept out of the news feed)
  { name: "TLDR News", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCSMqateX8OA2s1wsOR2EgJA", siteUrl: "https://www.youtube.com/channel/UCSMqateX8OA2s1wsOR2EgJA", region: "Global", category: "reference" },
  { name: "Think School", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCKZozRVHRYsYHGEyNKuhhdA", siteUrl: "https://www.youtube.com/channel/UCKZozRVHRYsYHGEyNKuhhdA", region: "Global", category: "reference" },
  { name: "Johnny Harris", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCmGSJVG3mCRXVOP4yZrU1Dw", siteUrl: "https://www.youtube.com/channel/UCmGSJVG3mCRXVOP4yZrU1Dw", region: "Global", category: "reference" },
  { name: "Peek TV", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCF_kWxafJ5Nr0OLd9aoCHsQ", siteUrl: "https://www.youtube.com/channel/UCF_kWxafJ5Nr0OLd9aoCHsQ", region: "Global", category: "reference" },
  { name: "Dylan Page", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCxdahU0yiKnA7Q5sHQljm_g", siteUrl: "https://www.youtube.com/channel/UCxdahU0yiKnA7Q5sHQljm_g", region: "Global", category: "reference" },
  { name: "Vox", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCLXo7UDZvByw2ixzpQCufnA", siteUrl: "https://www.youtube.com/channel/UCLXo7UDZvByw2ixzpQCufnA", region: "Global", category: "reference" },
  { name: "PolyMatter", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCgNg3vwj3xt7QOrcIDaHdFg", siteUrl: "https://www.youtube.com/channel/UCgNg3vwj3xt7QOrcIDaHdFg", region: "Global", category: "reference" },
  { name: "Wendover Productions", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC9RM-iSvTu1uPJb8X5yp3EQ", siteUrl: "https://www.youtube.com/channel/UC9RM-iSvTu1uPJb8X5yp3EQ", region: "Global", category: "reference" },
  { name: "CaspianReport", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCwnKziETDbHJtx78nIkfYug", siteUrl: "https://www.youtube.com/channel/UCwnKziETDbHJtx78nIkfYug", region: "Global", category: "reference" },
];
