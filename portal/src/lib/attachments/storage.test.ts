import assert from "node:assert/strict";
import test from "node:test";
import { supabaseStorageAuthHeaders } from "./storage";

test("sends current Supabase secret keys through the apikey header only", () => {
  assert.deepEqual(supabaseStorageAuthHeaders("sb_secret_example"), {
    apikey: "sb_secret_example",
  });
});

test("keeps legacy service-role JWT support", () => {
  const key = "header.payload.signature";
  assert.deepEqual(supabaseStorageAuthHeaders(key), {
    apikey: key,
    Authorization: `Bearer ${key}`,
  });
});
