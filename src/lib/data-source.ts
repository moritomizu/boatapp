import { mockData } from "@/lib/mock-data";

export const useMockData =
  process.env.NEXT_PUBLIC_DATA_SOURCE !== "firebase" ||
  process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

export const getInitialAppData = () => {
  return mockData;
};
