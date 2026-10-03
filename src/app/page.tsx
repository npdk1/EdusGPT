import HomeClient from "./HomeClient";

/**
 * The landing route stays a server component; every visible string lives in the
 * client island beside it, where `useCopy` can pick the language.
 *
 * No `metadata` here on purpose: the home page has never declared any, so the
 * title and description come from the root layout and stay unchanged.
 */
export default function HomePage() {
  return <HomeClient />;
}
