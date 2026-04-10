from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from app.schemas.trip_schema import TripRequest, TripResponse
from app.services.trip_service import TripService
from app.exception.exceptionhandling import TripPlannerException
from app.logger.logging import logger
from app.utils.destination_resolver import format_resolved_location, resolve_destination
from app.utils.place_suggestions import get_place_suggestions, search_place_names

router = APIRouter()
trip_service = TripService()


@router.post("/plan", response_model=TripResponse)
async def plan_trip(request: TripRequest):
    try:
        logger.info(f"Received trip request: {request.question[:80]}")
        return trip_service.get_trip_plan(
            request.question,
            request.model_provider,
            request.history,
            request.current_location,
            request.location_context,
        )
    except TripPlannerException as e:
        return JSONResponse(status_code=e.status_code, content={"error": e.message})
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/restore", response_model=TripResponse)
async def restore_trip(request: TripRequest):
    try:
        logger.info(f"Restoring trip details: {request.question[:80]}")
        answer = request.history[0].content if request.history else ""
        return trip_service.restore_trip_details(
            request.question,
            answer,
            request.current_location,
            request.location_context,
        )
    except TripPlannerException as e:
        return JSONResponse(status_code=e.status_code, content={"error": e.message})
    except Exception as e:
        logger.error(f"Unexpected restore error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/place-suggestions")
async def place_suggestions(
    location: str = Query(..., min_length=2),
    question: str = Query("", min_length=0),
):
    try:
        resolved = resolve_destination(question, location_hint=location) if question or location else None
        resolved_location = format_resolved_location(resolved) if resolved else location
        if not resolved:
            return {"location": resolved_location, "places": search_place_names(resolved_location, question=question)}

        suggestions = get_place_suggestions(
            float(resolved["lat"]),
            float(resolved["lon"]),
            resolved_location,
            question=question,
        )
        if not suggestions:
            return {"location": resolved_location, "places": search_place_names(resolved_location, question=question)}
        return {"location": resolved_location, "places": suggestions}
    except Exception as e:
        logger.error(f"Place suggestions error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
