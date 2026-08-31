"use client";

import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { type InputHTMLAttributes, useState } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  showPasswordLabel: string;
  hidePasswordLabel: string;
};

export function PasswordInput({
  showPasswordLabel,
  hidePasswordLabel,
  className = "form-input",
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeSlashIcon : EyeIcon;

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${className} pr-12`}
      />
      <button
        type="button"
        aria-label={visible ? hidePasswordLabel : showPasswordLabel}
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-focus"
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
