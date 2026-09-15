import type { ChangeEvent, FormEvent } from 'react';
import type { EventFilters as EventFiltersValue } from '../../api/types';

interface EventFiltersProps {
  value: EventFiltersValue;
  onChange(value: EventFiltersValue): void;
  onApply(): void;
  onClear(): void;
}

export function EventFilters({ value, onChange, onApply, onClear }: EventFiltersProps) {
  function updateTextField(field: 'search' | 'venue' | 'date') {
    return (event: ChangeEvent<HTMLInputElement>) => onChange({ ...value, [field]: event.target.value });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply();
  }

  return (
    <form className="event-filters" aria-label="Event filters" onSubmit={submit}>
      <div className="field-group field-search">
        <label htmlFor="event-search">Search events</label>
        <input id="event-search" name="search" type="search" value={value.search ?? ''} onChange={updateTextField('search')} />
      </div>
      <div className="field-group">
        <label htmlFor="event-venue">Venue</label>
        <input id="event-venue" name="venue" value={value.venue ?? ''} onChange={updateTextField('venue')} />
      </div>
      <div className="field-group">
        <label htmlFor="event-date">Date</label>
        <input id="event-date" name="date" type="date" value={value.date ?? ''} onChange={updateTextField('date')} />
      </div>
      <label className="check-field" htmlFor="event-upcoming">
        <input
          id="event-upcoming"
          name="upcoming"
          type="checkbox"
          checked={value.upcoming ?? false}
          onChange={(event) => onChange({ ...value, upcoming: event.target.checked })}
        />
        Upcoming only
      </label>
      <div className="filter-actions">
        <button type="submit">Apply filters</button>
        <button className="button-secondary" type="button" onClick={onClear}>Clear filters</button>
      </div>
    </form>
  );
}
