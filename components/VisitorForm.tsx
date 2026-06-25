"use client";

import React, { useState } from "react";
import { Plus, X, Calendar, User, Mail, Phone, Loader2, CheckCircle2 } from "lucide-react";

interface VisitorFormProps {
  token: string;
}

export default function VisitorForm({ token }: VisitorFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [machineryInput, setMachineryInput] = useState("");
  const [machineries, setMachineries] = useState<string[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{
    ticketNumber: string;
    visitorName: string;
    expectedDate: string;
  } | null>(null);

  // Handle adding machinery tag
  const handleAddMachinery = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = machineryInput.trim();
    if (trimmed && !machineries.includes(trimmed)) {
      setMachineries([...machineries, trimmed]);
      setMachineryInput("");
    }
  };

  // Handle removing machinery tag
  const handleRemoveMachinery = (indexToRemove: number) => {
    setMachineries(machineries.filter((_, idx) => idx !== indexToRemove));
  };

  // Handle key down in machinery input to allow adding on Enter
  const handleMachineryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddMachinery(e);
    }
  };

  // Submit the form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Form validations
    if (!name.trim()) {
      setSubmitError("Please enter your name or organization.");
      return;
    }

    if (!phone.trim()) {
      setSubmitError("Please enter your phone number.");
      return;
    }
    if (!expectedDate) {
      setSubmitError("Please select the expected entry date.");
      return;
    }
    if (machineries.length === 0) {
      setSubmitError("Please add at least one machinery that you are bringing into the facility.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/requests/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          visitor_name: name,
          visitor_email: "",
          visitor_phone: phone,
          expected_date: expectedDate,
          machineries,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request.");
      }

      setSubmitSuccess({
        ticketNumber: data.ticket_number,
        visitorName: name,
        expectedDate: expectedDate,
      });
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success view
  if (submitSuccess) {
    return (
      <div className="bg-white border border-zinc-200 shadow-sm rounded p-8 text-center max-w-lg w-full mx-auto my-12">
        <div className="flex justify-center mb-6 text-success">
          <CheckCircle2 className="w-16 h-16 stroke-[1.5]" />
        </div>
        <h2 className="text-2xl font-bold text-primary-dark mb-2">Request Submitted</h2>
        <p className="text-zinc-600 mb-6 text-sm">
          Your access request has been successfully registered. The administrator has been notified to review your entry.
        </p>

        <div className="bg-zinc-50 border border-zinc-200 rounded p-6 mb-6 text-left">
          <div className="mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">Ticket Number</span>
            <span className="font-mono text-lg font-bold text-primary-dark tracking-wide">{submitSuccess.ticketNumber}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-zinc-400 block font-medium">Visitor Name</span>
              <span className="font-semibold text-zinc-800">{submitSuccess.visitorName}</span>
            </div>
            <div>
              <span className="text-xs text-zinc-400 block font-medium">Expected Entry</span>
              <span className="font-semibold text-zinc-800">{submitSuccess.expectedDate}</span>
            </div>
          </div>
        </div>

        <p className="text-zinc-500 text-xs leading-relaxed mb-6">
          You will receive a WhatsApp notification once the admin approves or denies your request. 
          Please keep this Ticket Number handy to show at the gate for access.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 shadow-sm rounded max-w-xl w-full mx-auto my-8 overflow-hidden">
      {/* Header */}
      <div className="bg-primary-dark px-6 py-5 text-white">
        <h2 className="text-xl font-bold tracking-tight">Facility Access Request</h2>
        <p className="text-zinc-300 text-xs mt-1">
          Please fill out the details of your visit and any machineries you are bringing into the compound.
        </p>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {submitError && (
          <div className="bg-rose-50 border-l-2 border-destructive text-destructive px-4 py-3 rounded text-xs font-medium">
            {submitError}
          </div>
        )}

        {/* Name Input */}
        <div>
          <label htmlFor="name" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
            Name of Organization / Company / Person
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Clautechs Industries"
              className="block w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary-blue focus:border-primary-blue"
              required
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
            WhatsApp Phone Number
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <Phone className="w-4 h-4" />
            </div>
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +1234567890"
              className="block w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary-blue focus:border-primary-blue"
              required
            />
          </div>
          <p className="text-zinc-400 text-[10px] mt-1">Please include country code (e.g., +234...)</p>
        </div>

        {/* Expected Date Picker */}
        <div>
          <label htmlFor="date" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
            Expected Date of Entry
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              id="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 bg-white border border-zinc-300 rounded text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary-blue focus:border-primary-blue"
              required
            />
          </div>
        </div>

        {/* Machinery Input Listing Style */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
            Machinery coming in
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={machineryInput}
              onChange={(e) => setMachineryInput(e.target.value)}
              onKeyDown={handleMachineryKeyDown}
              placeholder="e.g. Caterpillar Excavator 320D"
              className="block flex-1 px-3 py-2 bg-white border border-zinc-300 rounded text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary-blue focus:border-primary-blue"
            />
            <button
              type="button"
              onClick={handleAddMachinery}
              className="bg-primary-blue hover:bg-primary-dark text-white text-xs font-medium px-4 py-2 rounded flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Machinery Tags List */}
          <div className="border border-zinc-200 rounded p-3 min-h-[80px] bg-zinc-50">
            {machineries.length === 0 ? (
              <p className="text-zinc-400 text-xs italic text-center py-4">No machinery added yet. Enter details above to build your list.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {machineries.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-800 px-2.5 py-1 rounded text-xs font-medium shadow-sm"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMachinery(idx)}
                      className="text-zinc-400 hover:text-destructive transition-colors focus:outline-none"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary-dark hover:bg-primary-blue text-white text-sm font-semibold py-2.5 rounded flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting Access Request...
              </>
            ) : (
              "Submit Registration"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
