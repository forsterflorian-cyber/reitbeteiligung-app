type BookingRequestStatusRecord = {
  id: string;
  status: string | null | undefined;
};

type BookingWithRequestId = {
  booking_request_id: string | null | undefined;
};

export function getAcceptedOperationalBookingRequestIdSet<T extends BookingRequestStatusRecord>(requests: readonly T[]) {
  const acceptedRequestIds = new Set<string>();

  for (const request of requests) {
    if (request.status === "accepted") {
      acceptedRequestIds.add(request.id);
    }
  }

  return acceptedRequestIds;
}

export function filterActiveOperationalBookings<T extends BookingWithRequestId>(
  bookings: readonly T[],
  acceptedRequestIds: ReadonlySet<string>
) {
  return bookings.filter((booking) => booking.booking_request_id && acceptedRequestIds.has(booking.booking_request_id));
}
