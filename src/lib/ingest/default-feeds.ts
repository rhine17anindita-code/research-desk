export interface FeedSeed {
  name: string;
  url: string;
  siteUrl?: string;
  region: string;
  language?: string;
  category: "international" | "regional" | "investigative" | "official" | "research" | "industry" | "science" | "analysis" | "topic" | "culture" | "video" | "reference" | "talk";
  enabled?: boolean;
  /** Channels this feed belongs to by default (ids). Default: the news channel. */
  channels?: string[];
}

/**
 * A starting set of publicly offered RSS/Atom feeds. Publishers change feed URLs
 * occasionally; failures are recorded per feed and shown in Settings → Sources,
 * where feeds can be disabled, replaced, or removed.
 *
 * Feeds give headline, link, date and the publisher's description. For stories that matter
 * (top and in-focus stories, projects, your research) the app also reads the full article
 * once and keeps it privately for research and writing; it is never republished.
 */
/** Bump when DEFAULT_FEEDS gains entries, so existing installations receive them once. */
export const FEED_CATALOG_VERSION = 6;

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
  // Direct feeds for outlets that used to arrive only through Google News (full articles, clean links).
  { name: "The Daily Star — Bangladesh", url: "https://www.thedailystar.net/news/bangladesh/rss.xml", siteUrl: "https://www.thedailystar.net", region: "South Asia", category: "regional" },
  { name: "Prothom Alo English", url: "https://en.prothomalo.com/feed/", siteUrl: "https://en.prothomalo.com", region: "South Asia", category: "regional" },
  { name: "The Hindu — National", url: "https://www.thehindu.com/news/national/feeder/default.rss", siteUrl: "https://www.thehindu.com", region: "South Asia", category: "regional" },
  { name: "Times of India — World", url: "https://timesofindia.indiatimes.com/rssfeeds/296589292.cms", siteUrl: "https://timesofindia.indiatimes.com", region: "South Asia", category: "international" },
  { name: "Hindustan Times — World", url: "https://www.hindustantimes.com/feeds/rss/world-news/rssfeed.xml", siteUrl: "https://www.hindustantimes.com", region: "South Asia", category: "international" },
  { name: "The Indian Express — World", url: "https://indianexpress.com/section/world/feed/", siteUrl: "https://indianexpress.com", region: "South Asia", category: "international" },
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

  // Talk shows & podcasts: what people are arguing about (kept out of the news feed, mined for ideas)
  { name: "BBC News Bangla", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UChPD2BQ2dJ-w00klQQkc-Qg", siteUrl: "https://www.youtube.com/channel/UChPD2BQ2dJ-w00klQQkc-Qg", region: "Bangladesh", language: "bn", category: "talk" },
  { name: "DW Bangla", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCIIkOzwZIdLfHa4Q13dQrkw", siteUrl: "https://www.youtube.com/channel/UCIIkOzwZIdLfHa4Q13dQrkw", region: "Bangladesh", language: "bn", category: "talk" },
  { name: "DW Alap", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCumGF1yJ1ZMnpueabAyXqrw", siteUrl: "https://www.youtube.com/channel/UCumGF1yJ1ZMnpueabAyXqrw", region: "Bangladesh", language: "bn", category: "talk" },
  { name: "VOA Bangla", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCzMeQSfaUSSuA4MgZ2wlT1Q", siteUrl: "https://www.youtube.com/channel/UCzMeQSfaUSSuA4MgZ2wlT1Q", region: "Bangladesh", language: "bn", category: "talk" },
  { name: "Zahed's Take", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCG_rdpyKuxsGIVoHpSWWuyA", siteUrl: "https://www.youtube.com/channel/UCG_rdpyKuxsGIVoHpSWWuyA", region: "Bangladesh", language: "bn", category: "talk" },
  { name: "Thikana (Khaled Muhiuddin)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCBovNpFWv8XT3WNG1fnmgyA", siteUrl: "https://www.youtube.com/channel/UCBovNpFWv8XT3WNG1fnmgyA", region: "Bangladesh", language: "bn", category: "talk" },
  { name: "Nagorik TV", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCu5_9xekpXOIlyqRHWqOd_Q", siteUrl: "https://www.youtube.com/channel/UCu5_9xekpXOIlyqRHWqOd_Q", region: "Bangladesh", language: "bn", category: "talk" },
  { name: "ATN News Talk Show", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCf_N7CDJqP7wZGagydzjdMQ", siteUrl: "https://www.youtube.com/channel/UCf_N7CDJqP7wZGagydzjdMQ", region: "Bangladesh", language: "bn", category: "talk" },
  { name: "Netra News", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC_DoG9dYBlfeN7Q-dsCMpQg", siteUrl: "https://www.youtube.com/channel/UC_DoG9dYBlfeN7Q-dsCMpQg", region: "Bangladesh", language: "bn", category: "talk" },
  { name: "Desh Rupantor", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCMbO-c2g92KPgOzYKDsTbug", siteUrl: "https://www.youtube.com/channel/UCMbO-c2g92KPgOzYKDsTbug", region: "Bangladesh", language: "bn", category: "talk" },
  { name: "Elias Hossain", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UClURnTgQiQpldGhtD4Fc7JQ", siteUrl: "https://www.youtube.com/channel/UClURnTgQiQpldGhtD4Fc7JQ", region: "Bangladesh", language: "bn", category: "talk" },
  { name: "Pinaki Bhattacharya", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCUbtdbJRpaXiUI_IlBOvPpA", siteUrl: "https://www.youtube.com/channel/UCUbtdbJRpaXiUI_IlBOvPpA", region: "Bangladesh", language: "bn", category: "talk" },
  { name: "Kanak Sarwar", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCp7lwpevv1TrvO4kaKiYfRg", siteUrl: "https://www.youtube.com/channel/UCp7lwpevv1TrvO4kaKiYfRg", region: "Bangladesh", language: "bn", category: "talk" },
  { name: "Prothom Alo (YouTube)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCeG7m5-AJ4I0H4EIleIty4Q", siteUrl: "https://www.youtube.com/channel/UCeG7m5-AJ4I0H4EIleIty4Q", region: "Bangladesh", language: "bn", category: "talk" },
  { name: "Lex Fridman", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCSHZKyawb77ixDdsGog4iWA", siteUrl: "https://www.youtube.com/channel/UCSHZKyawb77ixDdsGog4iWA", region: "Global", language: "en", category: "talk" },
  { name: "The Diary Of A CEO", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCGq-a57w-aPwyi3pW7XLiHw", siteUrl: "https://www.youtube.com/channel/UCGq-a57w-aPwyi3pW7XLiHw", region: "Global", language: "en", category: "talk" },
  { name: "The Rest Is Politics", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCsufaClk5if2RGqABb-09Uw", siteUrl: "https://www.youtube.com/channel/UCsufaClk5if2RGqABb-09Uw", region: "Global", language: "en", category: "talk" },
  { name: "The Rest Is History", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCUYK0BJZF3yNb2fw1EdAXUQ", siteUrl: "https://www.youtube.com/channel/UCUYK0BJZF3yNb2fw1EdAXUQ", region: "Global", language: "en", category: "talk" },
  { name: "Piers Morgan Uncensored", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCatt7TBjfBkiJWx8khav_Gg", siteUrl: "https://www.youtube.com/channel/UCatt7TBjfBkiJWx8khav_Gg", region: "Global", language: "en", category: "talk" },
  { name: "Breaking Points", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCDRIjKy6eZOvKtOELtTdeUA", siteUrl: "https://www.youtube.com/channel/UCDRIjKy6eZOvKtOELtTdeUA", region: "Global", language: "en", category: "talk" },
  { name: "All-In Podcast", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCESLZhusAkFfsNsApnjF_Cg", siteUrl: "https://www.youtube.com/channel/UCESLZhusAkFfsNsApnjF_Cg", region: "Global", language: "en", category: "talk" },
  { name: "Chris Williamson (Modern Wisdom)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCIaH-gZIVC432YRjNVvnyCA", siteUrl: "https://www.youtube.com/channel/UCIaH-gZIVC432YRjNVvnyCA", region: "Global", language: "en", category: "talk" },
  { name: "Triggernometry", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC7oPkqeHTwuOZ5CZ-R9f-6w", siteUrl: "https://www.youtube.com/channel/UC7oPkqeHTwuOZ5CZ-R9f-6w", region: "Global", language: "en", category: "talk" },
  { name: "Dhruv Rathee", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC-CSyyi47VX1lD9zyeABW3w", siteUrl: "https://www.youtube.com/channel/UC-CSyyi47VX1lD9zyeABW3w", region: "Global", language: "en", category: "talk" },
  { name: "BeerBiceps (The Ranveer Show)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCPxMZIFE856tbTfdkdjzTSQ", siteUrl: "https://www.youtube.com/channel/UCPxMZIFE856tbTfdkdjzTSQ", region: "Global", language: "en", category: "talk" },
  { name: "Zeteo (Mehdi Hasan)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCVG72F2Q5yCmLQfctNK6M2A", siteUrl: "https://www.youtube.com/channel/UCVG72F2Q5yCmLQfctNK6M2A", region: "Global", language: "en", category: "talk" },
  { name: "Channel 4 News", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCTrQ7HXWRRxr7OsOtodr2_w", siteUrl: "https://www.youtube.com/channel/UCTrQ7HXWRRxr7OsOtodr2_w", region: "Global", language: "en", category: "talk" },
  { name: "Times Radio", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCF-VP3b3oH0XASqsLI5rnLw", siteUrl: "https://www.youtube.com/channel/UCF-VP3b3oH0XASqsLI5rnLw", region: "Global", language: "en", category: "talk" },
  { name: "Firstpost (Vantage)", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCz8QaiQxApLq8sLNcszYyJw", siteUrl: "https://www.youtube.com/channel/UCz8QaiQxApLq8sLNcszYyJw", region: "Global", language: "en", category: "talk" },
  { name: "ThePrint", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCuyRsHZILrU7ZDIAbGASHdA", siteUrl: "https://www.youtube.com/channel/UCuyRsHZILrU7ZDIAbGASHdA", region: "Global", language: "en", category: "talk" },
  { name: "The Joe Rogan Experience", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCzQUP1qoWDoEbmsQxvdjxgQ", siteUrl: "https://www.youtube.com/channel/UCzQUP1qoWDoEbmsQxvdjxgQ", region: "Global", language: "en", category: "talk" },
  { name: "Tucker Carlson", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCGttrUON87gWfU6dMWm1fcA", siteUrl: "https://www.youtube.com/channel/UCGttrUON87gWfU6dMWm1fcA", region: "Global", language: "en", category: "talk" },
  { name: "NYT Opinion", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCm1fqkJ-Tq64bQzM6VRMicQ", siteUrl: "https://www.youtube.com/channel/UCm1fqkJ-Tq64bQzM6VRMicQ", region: "Global", language: "en", category: "talk" },
  { name: "The News Agents", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCVbgFf27--l2zYAneDEgyJA", siteUrl: "https://www.youtube.com/channel/UCVbgFf27--l2zYAneDEgyJA", region: "Global", language: "en", category: "talk" },
  { name: "PBD Podcast", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCGX7nGXpz-CmO_Arg-cgJ7A", siteUrl: "https://www.youtube.com/channel/UCGX7nGXpz-CmO_Arg-cgJ7A", region: "Global", language: "en", category: "talk" },
  { name: "Hasan Minhaj", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCarEovlrD9QY-fy-Z6apIDQ", siteUrl: "https://www.youtube.com/channel/UCarEovlrD9QY-fy-Z6apIDQ", region: "Global", language: "en", category: "talk" },
  { name: "John Mearsheimer", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCEaoODAZJF5w20lzcX1v03w", siteUrl: "https://www.youtube.com/channel/UCEaoODAZJF5w20lzcX1v03w", region: "Global", language: "en", category: "talk" },
  { name: "Glenn Diesen", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCZFCDIHTe9HGxtIuVDpBz7g", siteUrl: "https://www.youtube.com/channel/UCZFCDIHTe9HGxtIuVDpBz7g", region: "Global", language: "en", category: "talk" },
];
