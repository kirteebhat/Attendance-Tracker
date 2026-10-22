import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleProp, TextStyle } from "react-native";

export type IconName = string;

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export const Icon: React.FC<IconProps> = ({ name, size = 20, color = "#FFFFFF", style }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent: any = Ionicons;
  return <IconComponent name={name} size={size} color={color} style={style} />;
};

