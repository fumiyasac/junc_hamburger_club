package pickup

import (
	"testing"
	"time"
)

var defaultSettings = Settings{
	SlotIntervalMin: 15,
	SlotCapacity:    4,
	LeadTimeMin:     20,
	LookaheadDays:   3,
	OpenTime:        "11:00:00",
	CloseTime:       "21:00:00",
	ClosedWeekdays:  []int{},
}

func jstTime(date string, hhmm string) time.Time {
	loc := time.FixedZone("JST", 9*60*60)
	t, _ := time.ParseInLocation("2006-01-02 15:04", date+" "+hhmm, loc)
	return t
}

func TestParseClosedWeekdays(t *testing.T) {
	cases := []struct {
		in   string
		want []int
	}{
		{"", []int{}},
		{"0,6", []int{0, 6}},
		{"0, 7, abc, 3", []int{0, 3}},
	}
	for _, c := range cases {
		got := ParseClosedWeekdays(c.in)
		if len(got) != len(c.want) {
			t.Errorf("in=%q got=%v want=%v", c.in, got, c.want)
			continue
		}
		for i := range got {
			if got[i] != c.want[i] {
				t.Errorf("in=%q idx=%d got=%d want=%d", c.in, i, got[i], c.want[i])
			}
		}
	}
}

func TestDiffDaysJst(t *testing.T) {
	cases := []struct {
		date string
		now  time.Time
		want int
	}{
		{"2026-11-16", jstTime("2026-11-16", "15:00"), 0},
		{"2026-11-17", jstTime("2026-11-16", "23:30"), 1},
		{"2026-11-15", jstTime("2026-11-16", "00:30"), -1},
	}
	for _, c := range cases {
		got := DiffDaysJst(c.date, c.now)
		if got != c.want {
			t.Errorf("date=%s now=%v got=%d want=%d", c.date, c.now, got, c.want)
		}
	}
}

func TestGenerateSlots_ClosedWeekday(t *testing.T) {
	s := defaultSettings
	s.ClosedWeekdays = []int{1} // 月曜 (2026-11-16 は月曜)
	r := GenerateSlots("2026-11-16", s, jstTime("2026-11-16", "10:00"), nil)
	if !r.Closed || r.ClosedReason != ClosedWeekday {
		t.Errorf("expected closed_weekday, got Closed=%v Reason=%v", r.Closed, r.ClosedReason)
	}
}

func TestGenerateSlots_Past(t *testing.T) {
	r := GenerateSlots("2026-11-15", defaultSettings, jstTime("2026-11-16", "10:00"), nil)
	if r.ClosedReason != ClosedPast {
		t.Errorf("expected past, got %v", r.ClosedReason)
	}
}

func TestGenerateSlots_PastLookahead(t *testing.T) {
	r := GenerateSlots("2026-11-19", defaultSettings, jstTime("2026-11-16", "10:00"), nil)
	if r.ClosedReason != ClosedPastLookahead {
		t.Errorf("expected past_lookahead, got %v", r.ClosedReason)
	}
}

func TestGenerateSlots_SlotEnumeration(t *testing.T) {
	r := GenerateSlots("2026-11-16", defaultSettings, jstTime("2026-11-16", "09:00"), nil)
	if len(r.Slots) != 40 {
		t.Errorf("expected 40 slots, got %d", len(r.Slots))
	}
	first := r.Slots[0].StartAt
	if first.Hour() != 11 || first.Minute() != 0 {
		t.Errorf("first slot expected 11:00, got %v", first)
	}
	last := r.Slots[len(r.Slots)-1].StartAt
	if last.Hour() != 20 || last.Minute() != 45 {
		t.Errorf("last slot expected 20:45, got %v", last)
	}
}

func TestGenerateSlots_LeadTime(t *testing.T) {
	// now=11:40, lead=20 → 12:00 以降 OK、11:00-11:45 は lead_time
	r := GenerateSlots("2026-11-16", defaultSettings, jstTime("2026-11-16", "11:40"), nil)
	find := func(h, m int) SlotReason {
		for _, s := range r.Slots {
			if s.StartAt.Hour() == h && s.StartAt.Minute() == m {
				return s.Reason
			}
		}
		return ""
	}
	if find(11, 0) != ReasonLeadTime {
		t.Errorf("11:00 should be lead_time, got %v", find(11, 0))
	}
	if find(11, 45) != ReasonLeadTime {
		t.Errorf("11:45 should be lead_time, got %v", find(11, 45))
	}
	if find(12, 0) != "" {
		t.Errorf("12:00 should be available, got %v", find(12, 0))
	}
}

func TestGenerateSlots_NextDayIgnoresLeadTime(t *testing.T) {
	r := GenerateSlots("2026-11-17", defaultSettings, jstTime("2026-11-16", "23:50"), nil)
	if r.Slots[0].Reason != "" {
		t.Errorf("next day first slot should be available, got %v", r.Slots[0].Reason)
	}
}

func TestGenerateSlots_Full(t *testing.T) {
	reserved := map[time.Time]int{
		jstTime("2026-11-16", "12:00").UTC(): 4,
	}
	r := GenerateSlots("2026-11-16", defaultSettings, jstTime("2026-11-16", "09:00"), reserved)
	var found *Slot
	for i := range r.Slots {
		if r.Slots[i].StartAt.Hour() == 12 && r.Slots[i].StartAt.Minute() == 0 {
			found = &r.Slots[i]
			break
		}
	}
	if found == nil || found.Reason != ReasonFull {
		t.Errorf("12:00 should be full, got %+v", found)
	}
}

func TestValidatePickupAt_Boundary(t *testing.T) {
	_, code := ValidatePickupAt("2026-11-16T11:07:00+09:00", defaultSettings, jstTime("2026-11-16", "10:00"))
	if code != ErrBoundary {
		t.Errorf("expected boundary, got %v", code)
	}
}

func TestValidatePickupAt_OutOfHours_CloseExact(t *testing.T) {
	_, code := ValidatePickupAt("2026-11-16T21:00:00+09:00", defaultSettings, jstTime("2026-11-16", "10:00"))
	if code != ErrOutOfHours {
		t.Errorf("expected out_of_hours, got %v", code)
	}
}

func TestValidatePickupAt_LastSlotOK(t *testing.T) {
	_, code := ValidatePickupAt("2026-11-16T20:45:00+09:00", defaultSettings, jstTime("2026-11-16", "10:00"))
	if code != "" {
		t.Errorf("20:45 should be ok, got %v", code)
	}
}

func TestValidatePickupAt_LeadTimeExact(t *testing.T) {
	// now=10:00, +20min=10:20、11:00 はぎりぎり OK (startAt >= earliest)
	_, code := ValidatePickupAt("2026-11-16T11:00:00+09:00", defaultSettings, jstTime("2026-11-16", "10:00"))
	if code != "" {
		t.Errorf("11:00 should be ok (lead time 20min from 10:00), got %v", code)
	}
}

func TestValidatePickupAt_LeadTimeNG(t *testing.T) {
	// now=10:50, +20min=11:10、11:00 は NG
	_, code := ValidatePickupAt("2026-11-16T11:00:00+09:00", defaultSettings, jstTime("2026-11-16", "10:50"))
	if code != ErrLeadTime {
		t.Errorf("11:00 should be lead_time (now=10:50), got %v", code)
	}
}

func TestValidatePickupAt_ClosedDay(t *testing.T) {
	s := defaultSettings
	s.ClosedWeekdays = []int{1}
	_, code := ValidatePickupAt("2026-11-16T12:00:00+09:00", s, jstTime("2026-11-16", "10:00"))
	if code != ErrClosedDay {
		t.Errorf("expected closed_day, got %v", code)
	}
}

func TestValidatePickupAt_PastLookahead(t *testing.T) {
	_, code := ValidatePickupAt("2026-11-19T12:00:00+09:00", defaultSettings, jstTime("2026-11-16", "10:00"))
	if code != ErrPastLookahead {
		t.Errorf("expected past_lookahead, got %v", code)
	}
}
