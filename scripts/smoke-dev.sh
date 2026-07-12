#!/bin/bash
# Backend smoke test — run against the DEV Supabase project only.
#   bash scripts/smoke-dev.sh
# Requires .env.cloud (service-role key, gitignored) at the repo root.
#
# Covers: dual-role flags, invite create/resolve/redeem, goal sync (athlete
# override + coach edit + guard), termination (plan survives removal),
# re-attach without plan overwrite, SELF-COACHING (own code -> own roster),
# single-head + consumed-code guards. Creates throwaway smoke-*@example.com
# users and deletes them at the end.
set -u
cd "$(dirname "$0")/.."
URL=$(grep SUPABASE_URL .env.cloud | cut -d= -f2)
SVC=$(grep SUPABASE_SERVICE_ROLE_KEY .env.cloud | cut -d= -f2)
if [[ "$URL" != *"bawezljwxehadmkjeydw"* ]]; then
  echo "ABORT: .env.cloud does not point at the dev project — refusing to run."; exit 1
fi
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhd2V6bGp3eGVoYWRta2pleWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMDE0NzgsImV4cCI6MjA5Njc3NzQ3OH0.2gwbi5JxqidGOyrNSR0IveQfC2q_xMHs0IidloE7qzs"
TS=$(date +%s); PW="Smoke-Test-$TS!"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  PASS: $1"; }
bad() { FAIL=$((FAIL+1)); echo "  FAIL: $1  ->  $2"; }

admin() { curl -s -H "apikey: $SVC" -H "Authorization: Bearer $SVC" -H "Content-Type: application/json" "$@"; }
create_user() { admin -X POST "$URL/auth/v1/admin/users" -d "{\"email\":\"$1\",\"password\":\"$PW\",\"email_confirm\":true}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))"; }
signin() { curl -s -X POST "$URL/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$PW\"}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))"; }
rpc() { curl -s -X POST "$URL/rest/v1/rpc/$2" -H "apikey: $ANON" -H "Authorization: Bearer $1" -H "Content-Type: application/json" -d "$3"; }
svc_get() { admin "$URL/rest/v1/$1"; }

echo "== setup: users =="
C1="smoke-coach1-$TS@example.com";  U_C1=$(create_user "$C1")
C2="smoke-coach2-$TS@example.com";  U_C2=$(create_user "$C2")
A1="smoke-athlete-$TS@example.com"; U_A1=$(create_user "$A1")
[ -n "$U_C1" ] && [ -n "$U_C2" ] && [ -n "$U_A1" ] && ok "created 3 test users" || bad "user creation" "$U_C1/$U_C2/$U_A1"

admin -X PATCH "$URL/rest/v1/profiles?id=eq.$U_C1" -d '{"role":"coach","is_coach":true,"is_athlete":false,"title":"Head Coach"}' >/dev/null
admin -X PATCH "$URL/rest/v1/profiles?id=eq.$U_C2" -d '{"role":"coach","is_coach":true,"is_athlete":false,"title":"Head Coach"}' >/dev/null
R=$(svc_get "profiles?id=eq.$U_C1&select=is_coach,is_athlete")
echo "$R" | grep -q '"is_coach":true' && ok "coach1 promoted (is_coach=true)" || bad "coach promote" "$R"

J_C1=$(signin "$C1"); J_C2=$(signin "$C2"); J_A1=$(signin "$A1")
[ -n "$J_C1" ] && [ -n "$J_A1" ] && ok "signed in coach1 + athlete" || bad "signin" "tokens empty"

echo "== invite: create -> resolve -> redeem =="
CODE=$(rpc "$J_C1" create_invite '{"p_athlete_name":"Smoke Athlete","p_goal_race":"Smoke Half","p_goal_distance":"13.1 mi","p_goal_date":"2026-09-20","p_goal_time":"1:45:00","p_start_date":"2026-06-29"}' | tr -d '"')
[ ${#CODE} -eq 8 ] && ok "create_invite -> code $CODE" || bad "create_invite" "$CODE"

R=$(curl -s -X POST "$URL/rest/v1/rpc/resolve_invite" -H "apikey: $ANON" -H "Content-Type: application/json" -d "{\"p_code\":\"$CODE\"}")
echo "$R" | grep -q '"athlete_name":"Smoke Athlete"' && echo "$R" | grep -q '"goal_race":"Smoke Half"' \
  && ok "resolve_invite (anon) returns athlete_name + goal fields" || bad "resolve_invite shape" "$R"

R=$(rpc "$J_A1" redeem_invite "{\"p_code\":\"$CODE\"}")
LINK=$(svc_get "coach_athlete?athlete_id=eq.$U_A1&select=coach_id,relationship")
echo "$LINK" | grep -q "$U_C1" && ok "redeem links athlete to coach1 (head)" || bad "redeem link" "$R | $LINK"

PLAN=$(svc_get "plans?athlete_id=eq.$U_A1&select=goal_race,start_date")
echo "$PLAN" | grep -q '"goal_race":"Smoke Half"' && echo "$PLAN" | grep -q '"start_date":"2026-06-29"' \
  && ok "plan seeded from invite goal + start date" || bad "plan seed" "$PLAN"

echo "== goal sync: athlete override wins, coach edit syncs =="
rpc "$J_A1" update_my_goal '{"p_goal_race":"My Custom Race","p_goal_distance":"13.1 mi","p_goal_date":"2026-09-20","p_goal_time":"1:45:00"}' >/dev/null
PLAN=$(svc_get "plans?athlete_id=eq.$U_A1&select=goal_race")
echo "$PLAN" | grep -q '"goal_race":"My Custom Race"' && ok "athlete edit wins (update_my_goal)" || bad "athlete goal edit" "$PLAN"

rpc "$J_C1" update_athlete_goal "{\"p_athlete_id\":\"$U_A1\",\"p_goal_race\":\"Coach Adjusted\",\"p_goal_distance\":\"13.1 mi\",\"p_goal_date\":\"2026-10-04\",\"p_goal_time\":\"1:42:00\",\"p_start_date\":\"2026-07-06\"}" >/dev/null
PLAN=$(svc_get "plans?athlete_id=eq.$U_A1&select=goal_race,start_date")
echo "$PLAN" | grep -q '"goal_race":"Coach Adjusted"' && echo "$PLAN" | grep -q '"start_date":"2026-07-06"' \
  && ok "coach edit syncs incl. start date (update_athlete_goal)" || bad "coach goal edit" "$PLAN"

R=$(rpc "$J_C2" update_athlete_goal "{\"p_athlete_id\":\"$U_A1\",\"p_goal_race\":\"Hijack\",\"p_goal_distance\":null,\"p_goal_date\":null,\"p_goal_time\":null}")
echo "$R" | grep -qi "only this athlete" && ok "non-coach-of blocked from goal edit" || bad "goal edit guard" "$R"

echo "== termination: remove keeps plan; re-attach doesn't overwrite =="
curl -s -X DELETE "$URL/rest/v1/coach_athlete?coach_id=eq.$U_C1&athlete_id=eq.$U_A1" -H "apikey: $ANON" -H "Authorization: Bearer $J_C1" >/dev/null
LINK=$(svc_get "coach_athlete?athlete_id=eq.$U_A1&select=coach_id")
[ "$LINK" = "[]" ] && ok "coach removed athlete (link gone)" || bad "remove" "$LINK"
PLAN=$(svc_get "plans?athlete_id=eq.$U_A1&select=goal_race")
echo "$PLAN" | grep -q '"goal_race":"Coach Adjusted"' && ok "plan SURVIVES removal" || bad "plan after removal" "$PLAN"

CODE2=$(rpc "$J_C2" create_invite '{"p_athlete_name":"Smoke Athlete","p_goal_race":"New Coach Goal","p_goal_distance":"26.2 mi","p_goal_date":null,"p_goal_time":null}' | tr -d '"')
rpc "$J_A1" redeem_invite "{\"p_code\":\"$CODE2\"}" >/dev/null
LINK=$(svc_get "coach_athlete?athlete_id=eq.$U_A1&select=coach_id")
echo "$LINK" | grep -q "$U_C2" && ok "re-attach to a NEW coach works" || bad "re-attach" "$LINK"
PLAN=$(svc_get "plans?athlete_id=eq.$U_A1&select=goal_race")
echo "$PLAN" | grep -q '"goal_race":"Coach Adjusted"' && ok "existing plan NOT overwritten by new invite goal" || bad "plan overwrite" "$PLAN"

echo "== self-coaching: coach redeems their OWN invite =="
CODE3=$(rpc "$J_C1" create_invite '{"p_athlete_name":"Self","p_goal_race":"Self Half","p_goal_distance":null,"p_goal_date":null,"p_goal_time":null}' | tr -d '"')
R=$(rpc "$J_C1" redeem_invite "{\"p_code\":\"$CODE3\"}")
LINK=$(svc_get "coach_athlete?athlete_id=eq.$U_C1&coach_id=eq.$U_C1&select=relationship")
echo "$LINK" | grep -q '"relationship":"head"' && ok "coach1 SELF-COACHES (own code -> own roster, head)" || bad "self-coach link" "$R | $LINK"
P=$(svc_get "profiles?id=eq.$U_C1&select=is_coach,is_athlete")
echo "$P" | grep -q '"is_athlete":true' && ok "coach1 gained athlete role via own code" || bad "self dual-role" "$P"
PLAN=$(svc_get "plans?athlete_id=eq.$U_C1&select=goal_race")
echo "$PLAN" | grep -q '"goal_race":"Self Half"' && ok "self-coach plan seeded from own invite" || bad "self plan seed" "$PLAN"

echo "== guards: second head; consumed code =="
CODE4=$(rpc "$J_C1" create_invite '{"p_athlete_name":"Guard","p_goal_race":null,"p_goal_distance":null,"p_goal_date":null,"p_goal_time":null}' | tr -d '"')
R=$(rpc "$J_A1" redeem_invite "{\"p_code\":\"$CODE4\"}")
echo "$R" | grep -qi "already has a head coach" && ok "second head coach refused" || bad "single-head guard" "$R"
R=$(rpc "$J_C2" redeem_invite "{\"p_code\":\"$CODE3\"}")
echo "$R" | grep -qi "already used" && ok "consumed code refused" || bad "consumed guard" "$R"

echo "== dual-role: coach redeems another coach's invite =="
CODE5=$(rpc "$J_C1" create_invite '{"p_athlete_name":"Coach Two","p_goal_race":null,"p_goal_distance":null,"p_goal_date":null,"p_goal_time":null}' | tr -d '"')
R=$(rpc "$J_C2" redeem_invite "{\"p_code\":\"$CODE5\"}")
P=$(svc_get "profiles?id=eq.$U_C2&select=is_coach,is_athlete")
echo "$P" | grep -q '"is_coach":true' && echo "$P" | grep -q '"is_athlete":true' \
  && ok "coach2 is now DUAL-ROLE (is_coach + is_athlete)" || bad "dual-role grant" "$R | $P"

echo "== cleanup =="
for U in $U_C1 $U_C2 $U_A1; do admin -X DELETE "$URL/auth/v1/admin/users/$U" >/dev/null; done
LEFT=$(svc_get "profiles?id=in.($U_C1,$U_C2,$U_A1)&select=id")
[ "$LEFT" = "[]" ] && ok "test users deleted (cascade cleaned profiles)" || bad "cleanup" "$LEFT"

echo; echo "======== RESULT: $PASS passed, $FAIL failed ========"
exit $FAIL
