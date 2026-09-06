

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/src/components/ui/calendar";
import { Button } from "@/src/components/ui/button";
import { Label } from "@/src/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/src/shared/lib/utils";

export function DatePicker({
  label,
  date,
  onSelect,
  disabled,
}: {
  label: React.ReactNode;
  date?: Date;
  onSelect: (date?: Date) => void;
  disabled?: (date: Date) => boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            className={cn(
              "w-full justify-start bg-card border border-border text-left font-normal mt-2",
              !date && "text-muted-foreground",
            )}
          >
            {date ? format(date, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              onSelect(d);
              setOpen(false);
            }}
            disabled={disabled}
          />
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                onSelect(new Date());
                setOpen(false);
              }}
            >
              Today
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
