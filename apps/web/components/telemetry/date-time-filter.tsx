'use client';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Calendar } from '@workspace/ui/components/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover';
import { formatDate } from '@workspace/utils';
import { CalendarIcon, XIcon } from 'lucide-react';
import * as React from 'react';

export interface DateTimeFilterValue {
  date: Date;
  mode: 'after' | 'before' | 'same_day';
}

interface DateTimeFilterProps {
  value?: DateTimeFilterValue | null;
  onChange: (value: DateTimeFilterValue | null) => void;
}

export function DateTimeFilter({ value, onChange }: DateTimeFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    value ? value.date : undefined,
  );

  React.useEffect(() => {
    setSelectedDate(value ? value.date : undefined);
  }, [value]);

  const handleApply = () => {
    if (!selectedDate) {
      onChange(null);
      setOpen(false);
      return;
    }

    const newDate = new Date(selectedDate);
    newDate.setHours(0, 0, 0, 0);

    onChange({
      date: newDate,
      mode: 'after',
    });
    setOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedDate(undefined);
    onChange(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="bg-background h-8 text-xs font-normal">
          <CalendarIcon className="text-muted-foreground mr-1.5 size-3.5" />
          {value ? (
            <span className="text-foreground flex items-center gap-1.5 font-medium">
              <Badge variant="secondary" className="px-1 py-0 font-mono text-[10px] uppercase">
                Since
              </Badge>
              {formatDate(value.date, 'MMM d, yyyy')}
              <span
                role="button"
                tabIndex={0}
                className="hover:bg-muted ml-1 rounded-sm p-0.5"
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleClear();
                  }
                }}
              >
                <XIcon className="text-muted-foreground hover:text-foreground size-3" />
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">All time</span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="start">
        <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} />

        <div className="bg-muted/10 flex items-center justify-between border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-muted-foreground h-7 text-xs"
          >
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={!selectedDate}
            className="h-7 text-xs font-semibold"
          >
            Apply Filter
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
