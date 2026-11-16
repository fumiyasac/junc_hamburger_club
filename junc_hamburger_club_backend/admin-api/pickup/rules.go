// Package pickup は受け取り枠の計算ルールを TypeScript 側 pickup_rules.ts と
// 等価に実装する。正本は docs/pickup_slot_rules.md。
package pickup

import (
	"strconv"
	"strings"
	"time"
)

type Settings struct {
	SlotIntervalMin int
	SlotCapacity    int
	LeadTimeMin     int
	LookaheadDays   int
	OpenTime        string // "HH:MM:SS"
	CloseTime       string
	ClosedWeekdays  []int // 0=Sun ... 6=Sat
}

type SlotReason string

const (
	ReasonLeadTime      SlotReason = "lead_time"
	ReasonOutOfHours    SlotReason = "out_of_hours"
	ReasonFull          SlotReason = "full"
	ReasonPast          SlotReason = "past"
	ReasonPastLookahead SlotReason = "past_lookahead"
)

type ClosedReason string

const (
	ClosedWeekday       ClosedReason = "closed_weekday"
	ClosedPast          ClosedReason = "past"
	ClosedPastLookahead ClosedReason = "past_lookahead"
)

type Slot struct {
	StartAt time.Time
	Reason  SlotReason // 空文字なら available
}

type SlotListResult struct {
	Closed       bool
	ClosedReason ClosedReason
	Slots        []Slot
}

type ValidationError string

const (
	ErrInvalidFormat ValidationError = "pickup_invalid_format"
	ErrBoundary      ValidationError = "pickup_boundary"
	ErrClosedDay     ValidationError = "pickup_closed_day"
	ErrPastLookahead ValidationError = "pickup_past_lookahead"
	ErrOutOfHours    ValidationError = "pickup_out_of_hours"
	ErrLeadTime      ValidationError = "pickup_lead_time"
)

// JST の時計で動作させるため、Asia/Tokyo を固定で使用
var jst = time.FixedZone("JST", 9*60*60)

func ParseClosedWeekdays(csv string) []int {
	out := []int{}
	if csv == "" {
		return out
	}
	for _, s := range strings.Split(csv, ",") {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		n, err := strconv.Atoi(s)
		if err != nil {
			continue
		}
		if n >= 0 && n <= 6 {
			out = append(out, n)
		}
	}
	return out
}

func contains(xs []int, x int) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

func timeToMin(t string) int {
	parts := strings.Split(t, ":")
	h, _ := strconv.Atoi(parts[0])
	m, _ := strconv.Atoi(parts[1])
	return h*60 + m
}

// JstDateTime は dateJst (YYYY-MM-DD) と min (0:00 からの分数) を組み合わせて JST の time.Time を作る
func JstDateTime(dateJst string, min int) time.Time {
	t, _ := time.ParseInLocation("2006-01-02", dateJst, jst)
	return t.Add(time.Duration(min) * time.Minute)
}

func ToJstDateString(t time.Time) string {
	return t.In(jst).Format("2006-01-02")
}

func JstWeekday(t time.Time) int {
	return int(t.In(jst).Weekday())
}

func DiffDaysJst(dateJst string, now time.Time) int {
	target, _ := time.ParseInLocation("2006-01-02", dateJst, jst)
	todayStr := now.In(jst).Format("2006-01-02")
	today, _ := time.ParseInLocation("2006-01-02", todayStr, jst)
	return int(target.Sub(today) / (24 * time.Hour))
}

// GenerateSlots は指定日の枠リストを返す。reservedCounts が nil の場合は full 判定をスキップする。
func GenerateSlots(dateJst string, s Settings, now time.Time, reservedCounts map[time.Time]int) SlotListResult {
	target := JstDateTime(dateJst, 0)
	wd := JstWeekday(target)
	if contains(s.ClosedWeekdays, wd) {
		return SlotListResult{Closed: true, ClosedReason: ClosedWeekday, Slots: nil}
	}

	diff := DiffDaysJst(dateJst, now)
	if diff < 0 {
		return SlotListResult{Closed: true, ClosedReason: ClosedPast}
	}
	if diff >= s.LookaheadDays {
		return SlotListResult{Closed: true, ClosedReason: ClosedPastLookahead}
	}

	openMin := timeToMin(s.OpenTime)
	closeMin := timeToMin(s.CloseTime)
	interval := s.SlotIntervalMin
	lastStart := closeMin - interval

	slots := []Slot{}
	for m := openMin; m <= lastStart; m += interval {
		startAt := JstDateTime(dateJst, m)
		var reason SlotReason = ""

		if diff == 0 {
			earliest := now.Add(time.Duration(s.LeadTimeMin) * time.Minute)
			if startAt.Before(earliest) {
				reason = ReasonLeadTime
			}
		}

		if reason == "" && reservedCounts != nil {
			if reserved, ok := reservedCounts[startAt.UTC()]; ok {
				if reserved >= s.SlotCapacity {
					reason = ReasonFull
				}
			}
		}

		slots = append(slots, Slot{StartAt: startAt, Reason: reason})
	}

	return SlotListResult{Slots: slots}
}

// ValidatePickupAt は注文作成時の pickupAt 検証を行う。
// 戻り値: 正規化された time.Time (JST) と、エラー時はコード
func ValidatePickupAt(pickupAtIso string, s Settings, now time.Time) (time.Time, ValidationError) {
	t, err := time.Parse(time.RFC3339, pickupAtIso)
	if err != nil {
		return time.Time{}, ErrInvalidFormat
	}

	jstT := t.In(jst)
	dateJst := jstT.Format("2006-01-02")
	totalMin := jstT.Hour()*60 + jstT.Minute()

	// Step 2: boundary
	if jstT.Second() != 0 || totalMin%s.SlotIntervalMin != 0 {
		return time.Time{}, ErrBoundary
	}

	// Step 3: closed day
	if contains(s.ClosedWeekdays, int(jstT.Weekday())) {
		return time.Time{}, ErrClosedDay
	}

	// Step 4: lookahead
	diff := DiffDaysJst(dateJst, now)
	if diff < 0 || diff >= s.LookaheadDays {
		return time.Time{}, ErrPastLookahead
	}

	// Step 5: hours
	openMin := timeToMin(s.OpenTime)
	closeMin := timeToMin(s.CloseTime)
	if totalMin < openMin || totalMin > closeMin-s.SlotIntervalMin {
		return time.Time{}, ErrOutOfHours
	}

	// Step 6: lead time (same-day only)
	if diff == 0 {
		earliest := now.Add(time.Duration(s.LeadTimeMin) * time.Minute)
		if jstT.Before(earliest) {
			return time.Time{}, ErrLeadTime
		}
	}

	return JstDateTime(dateJst, totalMin), ""
}

// SettingsFromModel は DB から取得した PickupSettings 風構造から Settings を作る
type SettingsSource struct {
	SlotIntervalMin int
	SlotCapacity    int
	LeadTimeMin     int
	LookaheadDays   int
	OpenTime        string
	CloseTime       string
	ClosedWeekdays  string
}

func SettingsFromSource(src SettingsSource) Settings {
	return Settings{
		SlotIntervalMin: src.SlotIntervalMin,
		SlotCapacity:    src.SlotCapacity,
		LeadTimeMin:     src.LeadTimeMin,
		LookaheadDays:   src.LookaheadDays,
		OpenTime:        src.OpenTime,
		CloseTime:       src.CloseTime,
		ClosedWeekdays:  ParseClosedWeekdays(src.ClosedWeekdays),
	}
}
