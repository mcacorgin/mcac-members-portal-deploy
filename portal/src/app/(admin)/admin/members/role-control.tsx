"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, FieldError, Select } from "@/components/ui";
import { setMemberRoleAction } from "./role-actions";

type AssignableRole = "member" | "admin";

export function RoleControl({
  userId,
  name,
  role,
}: {
  userId: string;
  name: string;
  role: AssignableRole;
}) {
  const router = useRouter();
  const [value, setValue] = useState<AssignableRole>(role);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid min-w-36 gap-1">
      <label className="sr-only" htmlFor={`role-${userId}`}>Role for {name}</label>
      <Select
        id={`role-${userId}`}
        value={value}
        disabled={pending}
        onChange={(event) => setValue(event.target.value as AssignableRole)}
      >
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </Select>
      {value !== role ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await setMemberRoleAction(userId, value);
              if (!result.ok) {
                setError(result.message);
                setValue(role);
                return;
              }
              router.refresh();
            })
          }
        >
          {pending ? "Saving..." : "Save role"}
        </Button>
      ) : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}
