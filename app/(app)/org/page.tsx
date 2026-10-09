"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dqgwafdihafcttynfaea.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ3dhZmRpaGFmY3R0eW5mYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNjEwOTMsImV4cCI6MjEwNTYzNzA5M30._n-FGaXFyi3c1NxBDI0-DFfUA2nyqFhmELFc1LJat28";

type Theme = {
  pagePlane: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  muted: string;
  gridline: string;
  border: string;
  good: string;
};
const LIGHT: Theme = { pagePlane: "#f9f9f7", surface: "#ffffff", textPrimary: "#0b0b0b", textSecondary: "#52514e", muted: "#898781", gridline: "#e1e0d9", border: "rgba(11,11,11,0.10)", good: "#0ca30c" };
const DARK: Theme = { pagePlane: "#0d0d0d", surface: "#1a1a19", textPrimary: "#ffffff", textSecondary: "#c3c2b7", muted: "#898781", gridline: "#2c2c2a", border: "rgba(255,255,255,0.10)", good: "#0ca30c" };

type Profile = { id: string; full_name: string | null; email: string; role: string; manager_id: string | null };
type AdmRow = { counselor_id: string | null; net_excl_gst: number; total_paid: number };
type TargetRow = { counselor_id: string; target_students: number; target_revenue: number };

function fmtLakh(n: number, dp
