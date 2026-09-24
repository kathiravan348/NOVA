-- NOVA rate limiter (D40): one atomic check-and-take across every window of an endpoint.
-- KEYS: per window i: [2i-1] data key (sorted-set log or day counter), [2i] peak key; last: throttled counter.
-- ARGV: now_ms, member, window_count, throttled_ttl_ms, then per window: kind, limit, span_ms, peak_ttl_ms.
--   kind "roll": span = window length (entries newer than now - span count).
--   kind "day":  span = ms until the next daily reset (the counter key already names the period).
-- Returns {1, 0} when a slot was taken, {0, wait_ms} when any window is full (nothing is taken).

local now = tonumber(ARGV[1])
local member = ARGV[2]
local count = tonumber(ARGV[3])
local throttled_ttl = tonumber(ARGV[4])

local function arg(i, offset)
  return ARGV[4 + (i - 1) * 4 + offset]
end

local used = {}
local wait = 0
for i = 1, count do
  local kind, limit, span = arg(i, 1), tonumber(arg(i, 2)), tonumber(arg(i, 3))
  local key = KEYS[(i - 1) * 2 + 1]
  local current
  if kind == "roll" then
    redis.call("ZREMRANGEBYSCORE", key, "-inf", now - span)
    current = redis.call("ZCARD", key)
    if current >= limit then
      local freeing = redis.call("ZRANGE", key, current - limit, current - limit, "WITHSCORES")
      wait = math.max(wait, tonumber(freeing[2]) + span - now)
    end
  else
    current = tonumber(redis.call("GET", key) or "0")
    if current >= limit then
      wait = math.max(wait, span)
    end
  end
  used[i] = current
end

if wait > 0 then
  local throttled = KEYS[count * 2 + 1]
  redis.call("INCR", throttled)
  redis.call("PEXPIRE", throttled, throttled_ttl)
  return {0, wait}
end

for i = 1, count do
  local kind, span, peak_ttl = arg(i, 1), tonumber(arg(i, 3)), tonumber(arg(i, 4))
  local key, peak = KEYS[(i - 1) * 2 + 1], KEYS[(i - 1) * 2 + 2]
  local now_used
  if kind == "roll" then
    redis.call("ZADD", key, now, member)
    redis.call("PEXPIRE", key, span)
    now_used = used[i] + 1
  else
    now_used = redis.call("INCR", key)
    redis.call("PEXPIRE", key, span)
  end
  if now_used > tonumber(redis.call("GET", peak) or "0") then
    redis.call("SET", peak, now_used, "PX", peak_ttl)
  end
end
return {1, 0}
