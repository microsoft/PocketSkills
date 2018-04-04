using System;
using System.Collections.Generic;
using System.Linq;

namespace ASP
{
    /// <summary>
    /// Contains convenience extension methods that add intuitive methods to existing types.
    /// </summary>
    public static class Extensions
    {
        private enum TimeSpanElement
        {
            Millisecond,
            Second,
            Minute,
            Hour,
            Day
        }

        public static string ToLowerFriendlyString(this TimeSpan timeSpan, int maxNrOfElements = 2)
        {
            return timeSpan.ToFriendlyString(maxNrOfElements).ToLower();
        }

        public static string ToFriendlyString(this TimeSpan timeSpan, int maxNrOfElements = 2)
        {
            if (timeSpan == TimeSpan.Zero)
            {
                return "0 Seconds";
            }

            if (timeSpan.Days == (DateTimeOffset.Now - DateTimeOffset.MinValue).Days)
            {
                return "Never";
            }

            if (timeSpan.Days == (DateTimeOffset.MaxValue - DateTimeOffset.MinValue).Days)
            {
                return "Forever";
            }

            maxNrOfElements = Math.Max(Math.Min(maxNrOfElements, 5), 1);
            var parts = new[]
            {
                Tuple.Create(TimeSpanElement.Day, timeSpan.Days),
                Tuple.Create(TimeSpanElement.Hour, timeSpan.Hours),
                Tuple.Create(TimeSpanElement.Minute, timeSpan.Minutes),
                Tuple.Create(TimeSpanElement.Second, timeSpan.Seconds),
                Tuple.Create(TimeSpanElement.Millisecond, timeSpan.Milliseconds)
            }
            .SkipWhile(i => i.Item2 <= 0)
            .Take(maxNrOfElements)
            .Where(i => i.Item2 != 0);

            return string.Join(", ", parts.Select(p => string.Format("{0} {1}{2}", p.Item2, p.Item1, p.Item2 > 1 ? "s" : string.Empty)));
        }

        public static ulong Sum(this IEnumerable<uint> source)
        {
            ulong total = 0;

            foreach (var item in source)
            {
                total += item;
            }

            return total;
        }

        public static ulong Sum(this IEnumerable<ulong> source)
        {
            ulong total = 0;

            foreach (var item in source)
            {
                total += item;
            }

            return total;
        }

        public static TimeSpan Sum(this IEnumerable<TimeSpan> source)
        {
            TimeSpan total = TimeSpan.Zero;

            foreach (var item in source)
            {
                total += item;
            }

            return total;
        }

        public static TimeSpan Sum<T>(this IEnumerable<T> source, Func<T, TimeSpan> selector)
        {
            TimeSpan total = TimeSpan.Zero;

            foreach (var item in source)
            {
                total += selector(item);
            }

            return total;
        }

        public static double Average(this IEnumerable<uint> source)
        {
            ulong total = 0;
            double count = 0;

            foreach (var item in source)
            {
                total += item;
                count++;
            }

            return total / count;
        }

        public static double Average(this IEnumerable<ulong> source)
        {
            ulong total = 0;
            double count = 0;

            foreach (var item in source)
            {
                total += item;
                count++;
            }

            return total / count;
        }

        public static double Average<T>(this IEnumerable<T> source, Func<T, long> selector)
        {
            long total = 0;
            double count = 0;

            foreach (var item in source)
            {
                total += selector(item);
                count++;
            }

            return total / count;
        }

        public static TimeSpan Average(this IEnumerable<TimeSpan> source)
        {
            TimeSpan total = TimeSpan.Zero;
            long count = 0;

            foreach (var item in source)
            {
                total += item;
                count++;
            }

            return count > 0 ? new TimeSpan(total.Ticks / count) : TimeSpan.Zero;
        }

        public static TimeSpan Average<T>(this IEnumerable<T> source, Func<T, TimeSpan> selector)
        {
            TimeSpan total = TimeSpan.Zero;
            long count = 0;

            foreach (var item in source)
            {
                total += selector(item);
                count++;
            }

            return count > 0 ? new TimeSpan(total.Ticks / count) : TimeSpan.Zero;
        }
    }
}