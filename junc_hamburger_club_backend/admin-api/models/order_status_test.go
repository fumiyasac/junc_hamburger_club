package models

import (
	"reflect"
	"testing"
)

func TestAllowedNext(t *testing.T) {
	cases := []struct {
		from     OrderStatus
		expected []OrderStatus
	}{
		{StatusReceived, []OrderStatus{StatusPreparing, StatusCancelled}},
		{StatusPreparing, []OrderStatus{StatusReady, StatusCancelled}},
		{StatusReady, []OrderStatus{StatusCompleted}},
		{StatusCompleted, []OrderStatus{}},
		{StatusCancelled, []OrderStatus{}},
	}
	for _, c := range cases {
		got := AllowedNext(c.from)
		if !reflect.DeepEqual(got, c.expected) {
			// completed/cancelled は nil/empty slice のどちらも許容
			if len(got) == 0 && len(c.expected) == 0 {
				continue
			}
			t.Errorf("AllowedNext(%s) = %v, want %v", c.from, got, c.expected)
		}
	}
}

func TestCanTransition(t *testing.T) {
	ok := [][2]OrderStatus{
		{StatusReceived, StatusPreparing},
		{StatusReceived, StatusCancelled},
		{StatusPreparing, StatusReady},
		{StatusPreparing, StatusCancelled},
		{StatusReady, StatusCompleted},
	}
	ng := [][2]OrderStatus{
		{StatusReady, StatusCancelled}, // ready からのキャンセルは不可
		{StatusReceived, StatusReady},
		{StatusCompleted, StatusCancelled},
		{StatusCancelled, StatusPreparing},
		{StatusReady, StatusPreparing}, // 逆戻り不可
	}
	for _, c := range ok {
		if !CanTransition(c[0], c[1]) {
			t.Errorf("expected CanTransition(%s, %s) = true", c[0], c[1])
		}
	}
	for _, c := range ng {
		if CanTransition(c[0], c[1]) {
			t.Errorf("expected CanTransition(%s, %s) = false", c[0], c[1])
		}
	}
}

func TestIsValidOrderStatus(t *testing.T) {
	if !IsValidOrderStatus("received") {
		t.Error("received should be valid")
	}
	if IsValidOrderStatus("unknown") {
		t.Error("unknown should be invalid")
	}
}
