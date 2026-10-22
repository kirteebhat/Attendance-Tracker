import React from "react";
import { Redirect } from "expo-router";

export default function HomeScreenRedirect() {
  return <Redirect href="/(tabs)/home" />;
}
