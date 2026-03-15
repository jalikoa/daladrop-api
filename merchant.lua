wrk.method = "GET"

wrk.headers["Authorization"] = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJhZG1pbkBuZmNhcGkuY29tIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzczNTU5NDI3LCJleHAiOjE3NzM2NDU4Mjd9.LxiBV7aJ73FqWHPUruTE_XOzcyQLyMjcHlc-VvGParM"

request = function()
  return wrk.format(nil, "/merchants/1")
end
